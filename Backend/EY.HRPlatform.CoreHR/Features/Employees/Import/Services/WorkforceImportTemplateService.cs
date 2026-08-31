using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public sealed record WorkforceImportTemplate(byte[] Bytes, string FileName);

public interface IWorkforceImportTemplateService
{
    WorkforceImportTemplate Create();
}

public sealed class WorkforceImportTemplateService : IWorkforceImportTemplateService
{
    public const string SheetName = "Workforce";

    public static readonly string[] Headers =
    [
        "Employee Number", "First Name", "Last Name", "Preferred Name", "Work Email",
        "Employment Start", "Work Details Effective From", "Organization", "Display Title",
        "Location", "Manager", "Worker Reference", "Manager Reference", "Lifecycle Status",
        "Employment End", "Fusion Employee Reference", "Fusion Organization Reference",
        "Fusion Manager Reference",
    ];

    public WorkforceImportTemplate Create()
        => new(BuildWorkbook(), "Fusion-workforce-template.xlsx");

    private static byte[] BuildWorkbook()
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook, autoSave: true))
        {
            var workbookPart = document.AddWorkbookPart();
            workbookPart.Workbook = new Workbook();
            var stylesPart = workbookPart.AddNewPart<WorkbookStylesPart>();
            stylesPart.Stylesheet = CreateStyles();

            var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
            worksheetPart.Worksheet = CreateWorksheet();

            var sheets = workbookPart.Workbook.AppendChild(new Sheets());
            sheets.Append(new Sheet
            {
                Id = workbookPart.GetIdOfPart(worksheetPart),
                SheetId = 1,
                Name = SheetName,
            });
            workbookPart.Workbook.Save();
        }
        return stream.ToArray();
    }

    private static Worksheet CreateWorksheet()
    {
        var header = new Row { RowIndex = 1 };
        for (var index = 0; index < Headers.Length; index++)
            header.Append(TextCell(index + 1, 1, Headers[index], styleIndex: 1));

        return new Worksheet(
            new SheetViews(new SheetView(
                new Pane { VerticalSplit = 1D, TopLeftCell = "A2", ActivePane = PaneValues.BottomLeft, State = PaneStateValues.Frozen })
            { WorkbookViewId = 0 }),
            new Columns(
                Width(1, 20), Width(2, 18), Width(3, 18), Width(4, 18), Width(5, 28),
                Width(6, 20), Width(7, 28), Width(8, 24), Width(9, 24), Width(10, 18),
                Width(11, 24), Width(12, 20), Width(13, 20), Width(14, 20), Width(15, 20),
                Width(16, 28), Width(17, 30), Width(18, 26)),
            new SheetData(header),
            new AutoFilter { Reference = "A1:R2" });
    }

    private static Cell TextCell(int column, int row, string value, uint styleIndex = 0)
        => new()
        {
            CellReference = $"{ColumnName(column)}{row}",
            DataType = CellValues.InlineString,
            InlineString = new InlineString(new Text(value)),
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
