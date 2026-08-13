using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using EY.HRPlatform.CoreHR.Features.Organization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public sealed record OrganizationImportWorkbook(byte[] Bytes, string FileName);

public interface IOrganizationImportWorkbookService
{
    Task<OrganizationImportWorkbook> CreateTemplateAsync(CancellationToken cancellationToken);
    Task<OrganizationImportWorkbook> CreateExportAsync(DateOnly asOf, CancellationToken cancellationToken);
}

public sealed class OrganizationImportWorkbookService(IOrganizationService organizationService)
    : IOrganizationImportWorkbookService
{
    private static readonly string[] Headers =
        ["Fusion OrgUnit ID", "Business Code", "Name", "Type", "Parent Business Code"];

    public async Task<OrganizationImportWorkbook> CreateTemplateAsync(CancellationToken cancellationToken)
    {
        var types = await organizationService.GetTypesAsync(cancellationToken);
        return new OrganizationImportWorkbook(
            BuildWorkbook([], types.Select(type => type.DisplayName).ToList()),
            "Fusion-organization-template.xlsx");
    }

    public async Task<OrganizationImportWorkbook> CreateExportAsync(DateOnly asOf, CancellationToken cancellationToken)
    {
        var hierarchy = await organizationService.GetHierarchyAsync(asOf, cancellationToken);
        if (hierarchy.Roots.Count == 0)
            throw new OrganizationImportSourceException("NoCanonicalRootAsOfDate", "There is no current structure to export for this date.");
        var types = await organizationService.GetTypesAsync(cancellationToken);
        var nodes = Flatten(hierarchy.Roots).ToList();
        var codeById = nodes.ToDictionary(node => node.Unit.Id, node => node.Unit.Code);
        var rows = nodes.Select(node => (IReadOnlyList<string?>)
            [
                node.Unit.Id.ToString(),
                node.Unit.Code,
                node.Unit.Name,
                node.Unit.TypeName,
                node.Unit.ParentId is Guid parentId && codeById.TryGetValue(parentId, out var parentCode) ? parentCode : null,
            ]).ToList();
        return new OrganizationImportWorkbook(
            BuildWorkbook(rows, types.Select(type => type.DisplayName).ToList()),
            $"Fusion-organization-{asOf:yyyy-MM-dd}.xlsx");
    }

    private static byte[] BuildWorkbook(
        IReadOnlyList<IReadOnlyList<string?>> rows,
        IReadOnlyList<string> typeNames)
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook, autoSave: true))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook();
            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStyles();

            var organizationPart = workbookPart.AddNewPart<WorksheetPart>();
            organizationPart.Worksheet = CreateOrganizationSheet(rows, Math.Max(typeNames.Count, 1));
            var typesPart = workbookPart.AddNewPart<WorksheetPart>();
            typesPart.Worksheet = CreateTypesSheet(typeNames);

            var sheets = workbookPart.Workbook.AppendChild(new Sheets());
            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(organizationPart),
                SheetId = 1,
                Name = "Organization",
            });
            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(typesPart),
                SheetId = 2,
                Name = "Type values",
                State = SheetStateValues.Hidden,
            });
            workbookPart.Workbook.Save();
        }
        return stream.ToArray();
    }

    private static Worksheet CreateOrganizationSheet(IReadOnlyList<IReadOnlyList<string?>> rows, int typeCount)
    {
        var sheetData = new SheetData();
        var header = new Row { RowIndex = 1 };
        for (var index = 0; index < Headers.Length; index++)
            header.Append(TextCell(index + 1, 1, Headers[index], styleIndex: 1));
        sheetData.Append(header);
        for (var rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            var row = new Row { RowIndex = (uint)(rowIndex + 2) };
            for (var column = 0; column < Headers.Length; column++)
                row.Append(TextCell(column + 1, rowIndex + 2, column < rows[rowIndex].Count ? rows[rowIndex][column] : null));
            sheetData.Append(row);
        }

        var worksheet = new Worksheet(
            new SheetViews(new SheetView(
                new Pane { VerticalSplit = 1D, TopLeftCell = "A2", ActivePane = PaneValues.BottomLeft, State = PaneStateValues.Frozen })
            { WorkbookViewId = 0 }),
            new Columns(
                Width(1, 24), Width(2, 20), Width(3, 34), Width(4, 24), Width(5, 24)),
            sheetData,
            new AutoFilter { Reference = $"A1:E{Math.Max(rows.Count + 1, 2)}" });
        var validations = new DataValidations { Count = 1 };
        validations.Append(new DataValidation(
            new Formula1($"'Type values'!$A$2:$A${typeCount + 1}"))
        {
            Type = DataValidationValues.List,
            AllowBlank = true,
            ShowErrorMessage = true,
            ErrorTitle = "Choose an organization type",
            Error = "Select a type from the list.",
            SequenceOfReferences = new ListValue<StringValue> { InnerText = "D2:D10001" },
        });
        worksheet.Append(validations);
        return worksheet;
    }

    private static Worksheet CreateTypesSheet(IReadOnlyList<string> typeNames)
    {
        var data = new SheetData();
        var heading = new Row { RowIndex = 1 };
        heading.Append(TextCell(1, 1, "Organization type", 1));
        data.Append(heading);
        for (var index = 0; index < typeNames.Count; index++)
        {
            var row = new Row { RowIndex = (uint)(index + 2) };
            row.Append(TextCell(1, index + 2, typeNames[index]));
            data.Append(row);
        }
        return new Worksheet(data);
    }

    private static Cell TextCell(int column, int row, string? value, uint styleIndex = 0)
        => new()
        {
            CellReference = $"{ColumnName(column)}{row}",
            DataType = CellValues.InlineString,
            InlineString = new InlineString(new Text(value ?? string.Empty)),
            StyleIndex = styleIndex,
        };

    private static Column Width(uint index, double width)
        => new() { Min = index, Max = index, Width = width, CustomWidth = true };

    private static Stylesheet CreateStyles()
        => new(
            new Fonts(
                new Font(),
                new Font(new Bold(), new Color { Rgb = "FFFFFFFF" })),
            new Fills(
                new Fill(new PatternFill { PatternType = PatternValues.None }),
                new Fill(new PatternFill { PatternType = PatternValues.Gray125 }),
                new Fill(new PatternFill(new ForegroundColor { Rgb = "FF24352F" }) { PatternType = PatternValues.Solid })),
            new Borders(new Border()),
            new CellStyleFormats(new CellFormat()),
            new CellFormats(
                new CellFormat(),
                new CellFormat { FontId = 1, FillId = 2, ApplyFont = true, ApplyFill = true }));

    private static IEnumerable<OrganizationHierarchyNodeDto> Flatten(IEnumerable<OrganizationHierarchyNodeDto> nodes)
    {
        foreach (var node in nodes)
        {
            yield return node;
            foreach (var child in Flatten(node.Children)) yield return child;
        }
    }

    private static string ColumnName(int column)
    {
        var result = string.Empty;
        while (column > 0)
        {
            column--;
            result = (char)('A' + column % 26) + result;
            column /= 26;
        }
        return result;
    }
}
