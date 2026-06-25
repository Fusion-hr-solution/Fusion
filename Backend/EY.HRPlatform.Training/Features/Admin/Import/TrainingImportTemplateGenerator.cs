using ClosedXML.Excel;

namespace EY.HRPlatform.Training.Features.Admin.Import;

public interface ITrainingImportTemplateGenerator
{
    /// <summary>Builds the pre-formatted .xlsx import template (US-8.2.4). Category dropdown is seeded from the DB.</summary>
    byte[] Generate(IReadOnlyList<string> categories);
}

/// <summary>
/// ClosedXML template generator (US-8.2.4): four data sheets (Trainings/Sessions/Chapters/Content)
/// with colour-coded headers (required = yellow), one example row, in-cell dropdowns for the enum and
/// category columns (sourced from a hidden Lists sheet), and an Instructions sheet.
/// </summary>
public class TrainingImportTemplateGenerator : ITrainingImportTemplateGenerator
{
    private const int DropdownRows = 50; // rows 2..51 get dropdown validation

    public byte[] Generate(IReadOnlyList<string> categories)
    {
        using var workbook = new XLWorkbook();

        // Hidden lists sheet backs the dropdowns (categories may contain commas, so a range is safer
        // than an inline list).
        var lists = workbook.Worksheets.Add(ImportColumns.ListsSheet);
        WriteList(lists, 1, "Categories", categories);
        WriteList(lists, 2, "Formats", ImportColumns.Formats);
        WriteList(lists, 3, "BadgeLevels", ImportColumns.BadgeLevels);
        WriteList(lists, 4, "ContentTypes", ImportColumns.ContentTypes);
        WriteList(lists, 5, "Layouts", ImportColumns.Layouts);
        lists.Hide();

        var categoryRef = ListRange(1, categories.Count);
        var formatRef = ListRange(2, ImportColumns.Formats.Length);
        var badgeRef = ListRange(3, ImportColumns.BadgeLevels.Length);
        var contentTypeRef = ListRange(4, ImportColumns.ContentTypes.Length);
        var layoutRef = ListRange(5, ImportColumns.Layouts.Length);

        var trainings = AddDataSheet(workbook, ImportColumns.TrainingsSheet, ImportColumns.Trainings,
            ["T1", "Excel Fundamentals", "Intro to spreadsheets", "[pick a category]", "E-learning", "2", "Bronze", "2h", "No"]);
        if (categories.Count > 0)
            Dropdown(trainings, ImportColumns.Trainings, "Category", categoryRef);
        Dropdown(trainings, ImportColumns.Trainings, "Format", formatRef);
        Dropdown(trainings, ImportColumns.Trainings, "Badge Level", badgeRef);

        var sessions = AddDataSheet(workbook, ImportColumns.SessionsSheet, ImportColumns.Sessions,
            ["T1", "Day 1", "2026-09-01 09:00", "2026-09-01 17:00", "Room A", "20", "trainer@ey.com", "Jane Trainer"]);

        var chapters = AddDataSheet(workbook, ImportColumns.ChaptersSheet, ImportColumns.Chapters,
            ["T1", "Getting Started", "1", "SingleContent"]);
        Dropdown(chapters, ImportColumns.Chapters, "Layout", layoutRef);

        var content = AddDataSheet(workbook, ImportColumns.ContentSheet, ImportColumns.Content,
            ["T1", "Getting Started", "Article", "Welcome", "Some article text…", "", "10", "1"]);
        Dropdown(content, ImportColumns.Content, "Type", contentTypeRef);

        AddInstructionsSheet(workbook);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static IXLWorksheet AddDataSheet(
        XLWorkbook workbook, string name, ImportColumn[] columns, string[] exampleRow)
    {
        var ws = workbook.Worksheets.Add(name);

        for (int i = 0; i < columns.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = columns[i].Name;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = columns[i].Required ? XLColor.LightYellow : XLColor.White;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
        }

        for (int i = 0; i < exampleRow.Length && i < columns.Length; i++)
        {
            ws.Cell(2, i + 1).Value = exampleRow[i];
            ws.Cell(2, i + 1).Style.Font.Italic = true;
            ws.Cell(2, i + 1).Style.Font.FontColor = XLColor.Gray;
        }

        ws.Columns().AdjustToContents();
        ws.SheetView.FreezeRows(1);
        return ws;
    }

    private static void Dropdown(IXLWorksheet ws, ImportColumn[] columns, string columnName, string listFormula)
    {
        var index = Array.FindIndex(columns, c => c.Name == columnName);
        if (index < 0) return;
        var col = index + 1;
        var range = ws.Range(ws.Cell(2, col), ws.Cell(DropdownRows + 1, col));
        range.CreateDataValidation().List(listFormula, true);
    }

    private static void WriteList(IXLWorksheet lists, int col, string header, IReadOnlyList<string> values)
    {
        lists.Cell(1, col).Value = header;
        for (int i = 0; i < values.Count; i++)
            lists.Cell(i + 2, col).Value = values[i];
    }

    private static string ListRange(int col, int count)
    {
        var letter = XLHelper.GetColumnLetterFromNumber(col);
        var last = Math.Max(2, count + 1);
        return $"{ImportColumns.ListsSheet}!${letter}$2:${letter}${last}";
    }

    private static void AddInstructionsSheet(XLWorkbook workbook)
    {
        var ws = workbook.Worksheets.Add(ImportColumns.InstructionsSheet);
        var lines = new (string Text, bool Bold)[]
        {
            ("Training import — instructions", true),
            ("", false),
            ("1. Fill the Trainings sheet. Give each training a unique Ref (e.g. T1, T2).", false),
            ("2. Required columns have a yellow header and must be filled.", false),
            ("3. Category, Format and Badge Level use dropdowns. Category must already exist.", false),
            ("4. Format = 'E-learning' or 'On-site'.", false),
            ("", false),
            ("5. On the Sessions sheet (on-site trainings), reference the training by its Ref.", false),
            ("   Dates use 'yyyy-MM-dd HH:mm' (UTC). Trainer Email links an internal trainer; otherwise", false),
            ("   the Trainer Name is kept as an external trainer.", false),
            ("", false),
            ("6. On the Chapters sheet (e-learning), reference the training Ref and give each chapter an Order.", false),
            ("7. On the Content sheet, reference the training Ref and the parent Chapter Title.", false),
            ("   Type = Article (use Text), Video (use URL), Pdf / Exercise (use URL to a pre-uploaded file).", false),
            ("", false),
            ("8. On-site trainings need at least one session; e-learning trainings need at least one chapter.", false),
            ("9. The example rows (italic, grey) are a guide — replace or delete them before importing.", false),
        };

        for (int i = 0; i < lines.Length; i++)
        {
            var cell = ws.Cell(i + 1, 1);
            cell.Value = lines[i].Text;
            if (lines[i].Bold)
            {
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontSize = 13;
            }
        }
        ws.Column(1).Width = 110;
    }
}
