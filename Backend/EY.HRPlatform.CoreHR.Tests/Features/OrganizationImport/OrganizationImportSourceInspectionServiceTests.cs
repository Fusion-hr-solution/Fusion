using System.Text;
using System.IO.Compression;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportSourceInspectionServiceTests
{
    private readonly OrganizationImportSourceInspectionService _service = new();

    [Theory]
    [InlineData(",")]
    [InlineData(";")]
    [InlineData("\t")]
    public async Task InspectCsv_PreservesOrderedLabelsAndCells(string delimiter)
    {
        var csv = $"Name{delimiter}Name{delimiter}{Environment.NewLine}Root{delimiter}Division{delimiter}Extra";
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = Assert.IsType<OrganizationSourceReady>(await _service.InspectAsync(
            stream, "structure.csv", "text/csv", null, CancellationToken.None));

        Assert.Equal(["Name", "Name", null], result.Source.Table.Columns.Select(column => column.SourceLabel));
        Assert.Equal(["Root", "Division", "Extra"], result.Source.Table.Rows[0]);
        Assert.Equal("csv", result.Source.SourceFormat);
    }

    [Fact]
    public async Task InspectWorkbook_WithMultipleUsableSheets_RequiresTargetedChoice()
    {
        await using var stream = new MemoryStream(CreateWorkbook(
            ("North", false, new[] { new[] { "Name" }, new[] { "North root" } }),
            ("South", false, new[] { new[] { "Name" }, new[] { "South root" } }),
            ("Support", true, new[] { new[] { "Name" }, new[] { "Ignore" } })));

        var result = Assert.IsType<OrganizationSheetSelectionRequired>(await _service.InspectAsync(
            stream, "structure.xlsx", null, null, CancellationToken.None));

        Assert.Equal(["North", "South"], result.Choice.CandidateSheetNames);
    }

    [Fact]
    public async Task InspectWorkbook_WithOneVisibleUsableSheet_AutoSelectsIt()
    {
        await using var stream = new MemoryStream(CreateWorkbook(
            ("Organization", false, new[] { new[] { "Name" }, new[] { "Root" } }),
            ("Support", true, new[] { new[] { "Name" }, new[] { "Ignore" } })));

        var result = Assert.IsType<OrganizationSourceReady>(await _service.InspectAsync(
            stream, "structure.xlsx", null, null, CancellationToken.None));

        Assert.Equal("Organization", result.Source.SelectedSheetName);
        Assert.Equal("Root", result.Source.Table.Rows[0][0]);
    }

    [Fact]
    public async Task InspectWorkbook_WithSelection_ReturnsOnlySelectedTable()
    {
        await using var stream = new MemoryStream(CreateWorkbook(
            ("North", false, new[] { new[] { "Name" }, new[] { "North root" } }),
            ("South", false, new[] { new[] { "Name" }, new[] { "South root" } })));

        var result = Assert.IsType<OrganizationSourceReady>(await _service.InspectAsync(
            stream, "structure.xlsx", null, "South", CancellationToken.None));

        Assert.Equal("South", result.Source.SelectedSheetName);
        Assert.Equal("South root", result.Source.Table.Rows[0][0]);
    }

    [Fact]
    public async Task Inspect_RejectsSignatureMismatchWithoutEchoingSourceContent()
    {
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes("highly-sensitive-cell"));

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.xlsx", null, null, CancellationToken.None));

        Assert.Equal("SignatureMismatch", exception.Code);
        Assert.DoesNotContain("highly-sensitive", exception.Message);
    }

    [Fact]
    public async Task InspectCsv_RejectsMoreThanTenThousandDataRows()
    {
        var builder = new StringBuilder("Name\n");
        for (var index = 0; index < 10_001; index++) builder.AppendLine($"Unit {index}");
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(builder.ToString()));

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.csv", null, null, CancellationToken.None));

        Assert.Equal("RowLimitExceeded", exception.Code);
    }

    [Fact]
    public async Task Inspect_RejectsFilesOverTenMegabytesBeforeParsing()
    {
        await using var stream = new MemoryStream(new byte[OrganizationImportSourceInspectionService.MaxFileBytes + 1]);

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.csv", null, null, CancellationToken.None));

        Assert.Equal("FileTooLarge", exception.Code);
        Assert.Equal(413, exception.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Name\n")]
    [InlineData("\nRoot")]
    public async Task InspectCsv_RejectsSourcesWithoutLabelsAndData(string csv)
    {
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.csv", null, null, CancellationToken.None));

        Assert.Contains(exception.Code, new[] { "Empty", "NoUsableTable" });
    }

    [Fact]
    public async Task InspectCsv_RejectsColumnAndCellBounds()
    {
        var tooManyColumns = string.Join(',', Enumerable.Repeat("Label", 257)) + "\n"
            + string.Join(',', Enumerable.Repeat("Value", 257));
        await using var columnStream = new MemoryStream(Encoding.UTF8.GetBytes(tooManyColumns));
        var columnException = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            columnStream, "structure.csv", null, null, CancellationToken.None));
        Assert.Equal("ColumnLimitExceeded", columnException.Code);

        var longCell = $"Name\n{new string('x', 32_768)}";
        await using var cellStream = new MemoryStream(Encoding.UTF8.GetBytes(longCell));
        var cellException = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            cellStream, "structure.csv", null, null, CancellationToken.None));
        Assert.Equal("CellLimitExceeded", cellException.Code);
    }

    [Fact]
    public async Task InspectWorkbook_RejectsPasswordProtectedAndCorruptPackagesWithoutParserDetails()
    {
        await using var protectedStream = new MemoryStream(
            new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 });
        var protectedException = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            protectedStream, "structure.xlsx", null, null, CancellationToken.None));
        Assert.Equal("PasswordProtected", protectedException.Code);

        await using var corruptStream = new MemoryStream(new byte[] { 0x50, 0x4B, 0x03, 0x04, 1, 2, 3, 4 });
        var corruptException = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            corruptStream, "structure.xlsx", null, null, CancellationToken.None));
        Assert.Equal("Unreadable", corruptException.Code);
        Assert.DoesNotContain("ZipArchive", corruptException.Message);
    }

    [Theory]
    [InlineData("xl/vbaProject.bin")]
    [InlineData("xl/embeddings/object1.bin")]
    [InlineData("xl/externalLinks/externalLink1.xml")]
    [InlineData("xl/connections.xml")]
    public async Task InspectWorkbook_RejectsActiveAndExternalPackageEntries(string entryName)
    {
        await using var stream = new MemoryStream(CreateZip((entryName, "unsafe")));

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.xlsx", null, null, CancellationToken.None));

        Assert.Equal("UnsafeWorkbookContent", exception.Code);
    }

    [Fact]
    public async Task InspectWorkbook_RejectsUnsafeCompressionExpansion()
    {
        await using var stream = new MemoryStream(CreateZip(("xl/worksheets/sheet1.xml", new string('x', 250_000))));

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.xlsx", null, null, CancellationToken.None));

        Assert.Equal("PackageLimitExceeded", exception.Code);
    }

    [Fact]
    public async Task InspectWorkbook_DoesNotEvaluateFormulaWithoutCachedValue()
    {
        await using var stream = new MemoryStream(CreateFormulaWorkbookWithoutCache());

        var exception = await Assert.ThrowsAsync<OrganizationImportSourceException>(() => _service.InspectAsync(
            stream, "structure.xlsx", null, null, CancellationToken.None));

        Assert.Equal("NoUsableTable", exception.Code);
    }

    private static byte[] CreateWorkbook(params (string Name, bool Hidden, string[][] Rows)[] sheets)
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook, true))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook();
            var workbookSheets = workbookPart.Workbook.AppendChild(new Sheets());
            uint id = 1;
            foreach (var fixture in sheets)
            {
                var part = workbookPart.AddNewPart<WorksheetPart>();
                var data = new SheetData();
                for (var rowIndex = 0; rowIndex < fixture.Rows.Length; rowIndex++)
                {
                    var row = new Row { RowIndex = (uint)(rowIndex + 1) };
                    for (var column = 0; column < fixture.Rows[rowIndex].Length; column++)
                    {
                        row.Append(new Cell
                        {
                            CellReference = $"{(char)('A' + column)}{rowIndex + 1}",
                            DataType = CellValues.InlineString,
                            InlineString = new InlineString(new Text(fixture.Rows[rowIndex][column])),
                        });
                    }
                    data.Append(row);
                }
                part.Worksheet = new Worksheet(data);
                workbookSheets.Append(new Sheet
                {
                    Id = workbookPart.GetIdOfPart(part),
                    SheetId = id++,
                    Name = fixture.Name,
                    State = fixture.Hidden ? SheetStateValues.Hidden : SheetStateValues.Visible,
                });
            }
            workbookPart.Workbook.Save();
        }
        return stream.ToArray();
    }

    private static byte[] CreateZip(params (string Name, string Contents)[] entries)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var fixture in entries)
            {
                var entry = archive.CreateEntry(fixture.Name, CompressionLevel.SmallestSize);
                using var writer = new StreamWriter(entry.Open(), Encoding.UTF8, 1024, leaveOpen: false);
                writer.Write(fixture.Contents);
            }
        }
        return stream.ToArray();
    }

    private static byte[] CreateFormulaWorkbookWithoutCache()
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook, true))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook();
            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            worksheetPart.Worksheet = new Worksheet(new SheetData(
                new Row(
                    new Cell { CellReference = "A1", DataType = CellValues.InlineString, InlineString = new InlineString(new Text("Name")) })
                { RowIndex = 1 },
                new Row(
                    new Cell { CellReference = "A2", CellFormula = new CellFormula("NOW()") })
                { RowIndex = 2 }));
            workbookPart.Workbook.AppendChild(new Sheets(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1,
                Name = "Organization",
            }));
            workbookPart.Workbook.Save();
        }
        return stream.ToArray();
    }
}
