using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportWorkbookServiceTests
{
    [Fact]
    public async Task Template_ContainsLockedColumnsAndTypeValidationSheet()
    {
        var organization = new Mock<IOrganizationService>();
        organization.Setup(service => service.GetTypesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new OrganizationalUnitTypeDto(Guid.NewGuid(), "Division", true)]);
        var service = new OrganizationImportWorkbookService(organization.Object);

        var workbook = await service.CreateTemplateAsync(CancellationToken.None);
        using var stream = new MemoryStream(workbook.Bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var part = document.WorkbookPart!;
        var sheets = part.Workbook.Sheets!.Elements<Sheet>().ToList();
        Assert.Equal(["Organization", "Type values"], sheets.Select(sheet => sheet.Name!.Value));
        Assert.Equal(SheetStateValues.Hidden, sheets[1].State!.Value);
        var organizationSheet = (WorksheetPart)part.GetPartById(sheets[0].Id!);
        var labels = organizationSheet.Worksheet.Descendants<Cell>().Take(5).Select(cell => cell.InnerText).ToList();
        Assert.Equal(["Fusion OrgUnit ID", "Business Code", "Name", "Type", "Parent Business Code"], labels);
        Assert.Single(organizationSheet.Worksheet.Descendants<DataValidation>());
    }

    [Fact]
    public async Task Export_UsesDeterministicHierarchyOrderAndStableIds()
    {
        var date = new DateOnly(2026, 8, 12);
        var rootId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var root = State(rootId, "ROOT", "Asteria", null, null, date);
        var child = State(childId, "OPS", "Operations", rootId, "Asteria", date);
        var organization = new Mock<IOrganizationService>();
        organization.Setup(service => service.GetTypesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new OrganizationalUnitTypeDto(Guid.NewGuid(), "Division", true)]);
        organization.Setup(service => service.GetHierarchyAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationHierarchyDto(date,
                [new OrganizationHierarchyNodeDto(root, [new OrganizationHierarchyNodeDto(child, [])])]));
        var service = new OrganizationImportWorkbookService(organization.Object);

        var workbook = await service.CreateExportAsync(date, CancellationToken.None);
        using var stream = new MemoryStream(workbook.Bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheet = document.WorkbookPart!.Workbook.Sheets!.Elements<Sheet>().First();
        var worksheet = (WorksheetPart)document.WorkbookPart.GetPartById(sheet.Id!);
        var rows = worksheet.Worksheet.Descendants<Row>().ToList();
        Assert.Equal(3, rows.Count);
        Assert.Equal(rootId.ToString(), rows[1].Elements<Cell>().First().InnerText);
        Assert.Equal(childId.ToString(), rows[2].Elements<Cell>().First().InnerText);
        Assert.Equal("ROOT", rows[2].Elements<Cell>().Last().InnerText);
    }

    [Theory]
    [InlineData("2025-12-31", "Historical root")]
    [InlineData("2026-08-12", "Current root")]
    [InlineData("2027-01-01", "Future root")]
    public async Task Export_UsesTheRequestedPastTodayOrFutureSnapshot(string dateText, string rootName)
    {
        var date = DateOnly.Parse(dateText);
        var rootId = Guid.NewGuid();
        var organization = new Mock<IOrganizationService>();
        organization.Setup(service => service.GetTypesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new OrganizationalUnitTypeDto(Guid.NewGuid(), "Organization", true)]);
        organization.Setup(service => service.GetHierarchyAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationHierarchyDto(date,
                [new OrganizationHierarchyNodeDto(State(rootId, "ROOT", rootName, null, null, date), [])]));
        var service = new OrganizationImportWorkbookService(organization.Object);

        var workbook = await service.CreateExportAsync(date, CancellationToken.None);

        using var stream = new MemoryStream(workbook.Bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var sheet = document.WorkbookPart!.Workbook.Sheets!.Elements<Sheet>().First();
        var worksheet = (WorksheetPart)document.WorkbookPart.GetPartById(sheet.Id!);
        var cells = worksheet.Worksheet.Descendants<Row>().ElementAt(1).Elements<Cell>().ToList();
        Assert.Equal(rootId.ToString(), cells[0].InnerText);
        Assert.Equal(rootName, cells[2].InnerText);
        organization.Verify(service => service.GetHierarchyAsync(date, It.IsAny<CancellationToken>()), Times.Once);
    }

    private static OrganizationUnitStateDto State(
        Guid id, string code, string name, Guid? parentId, string? parentName, DateOnly date)
        => new(id, code, name, Guid.NewGuid(), "Division", parentId, parentName, name,
            OrgUnitLifecycleState.Active, date, 1);
}
