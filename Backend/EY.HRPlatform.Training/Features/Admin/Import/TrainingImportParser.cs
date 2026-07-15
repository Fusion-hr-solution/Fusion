using System.Globalization;
using ClosedXML.Excel;

namespace EY.HRPlatform.Training.Features.Admin.Import;

internal record RawTrainingRow(
    int RowNumber, string? Ref, string? Title, string? Description, string? Category,
    string? Format, string? Credits, string? BadgeLevel, string? Duration, string? Mandatory);

internal record RawSessionRow(
    int RowNumber, string? TrainingRef, string? PartTitle, string? Start, string? End,
    string? Room, string? Capacity, string? TrainerEmail, string? TrainerName);

internal record RawChapterRow(
    int RowNumber, string? TrainingRef, string? Title, string? Order, string? Layout);

internal record RawContentRow(
    int RowNumber, string? TrainingRef, string? ChapterTitle, string? Type, string? Title,
    string? Text, string? Url, string? DurationMin, string? Order);

internal record ParsedWorkbook(
    List<RawTrainingRow> Trainings,
    List<RawSessionRow> Sessions,
    List<RawChapterRow> Chapters,
    List<RawContentRow> Content,
    List<string> MissingSheets);

/// <summary>
/// Reads a training import workbook into raw rows via the shared <see cref="ImportColumns"/> contract
/// (US-8.2.3). Headers are matched case-insensitively; fully-empty rows are skipped. No validation
/// here — that is <see cref="TrainingImportValidator"/>'s job.
/// </summary>
internal static class TrainingImportParser
{
    public static ParsedWorkbook Parse(Stream stream)
    {
        using var workbook = new XLWorkbook(stream);
        var missing = new List<string>();

        var trainingsWs = Sheet(workbook, ImportColumns.TrainingsSheet, missing);
        var sessionsWs = Sheet(workbook, ImportColumns.SessionsSheet, missing);
        var chaptersWs = Sheet(workbook, ImportColumns.ChaptersSheet, missing);
        var contentWs = Sheet(workbook, ImportColumns.ContentSheet, missing);

        return new ParsedWorkbook(
            ParseRows(trainingsWs, (ws, map, r) => new RawTrainingRow(
                r,
                Cell(ws, map, r, "Ref"), Cell(ws, map, r, "Title"), Cell(ws, map, r, "Description"),
                Cell(ws, map, r, "Category"), Cell(ws, map, r, "Format"), Cell(ws, map, r, "Credits"),
                Cell(ws, map, r, "Badge Level"), Cell(ws, map, r, "Duration"), Cell(ws, map, r, "Mandatory"))),
            ParseRows(sessionsWs, (ws, map, r) => new RawSessionRow(
                r,
                Cell(ws, map, r, "Training Ref"), Cell(ws, map, r, "Part Title"), Cell(ws, map, r, "Start (UTC)"),
                Cell(ws, map, r, "End (UTC)"), Cell(ws, map, r, "Room"), Cell(ws, map, r, "Capacity"),
                Cell(ws, map, r, "Trainer Email"), Cell(ws, map, r, "Trainer Name"))),
            ParseRows(chaptersWs, (ws, map, r) => new RawChapterRow(
                r,
                Cell(ws, map, r, "Training Ref"), Cell(ws, map, r, "Chapter Title"),
                Cell(ws, map, r, "Order"), Cell(ws, map, r, "Layout"))),
            ParseRows(contentWs, (ws, map, r) => new RawContentRow(
                r,
                Cell(ws, map, r, "Training Ref"), Cell(ws, map, r, "Chapter Title"), Cell(ws, map, r, "Type"),
                Cell(ws, map, r, "Title"), Cell(ws, map, r, "Text"), Cell(ws, map, r, "URL"),
                Cell(ws, map, r, "Duration (min)"), Cell(ws, map, r, "Order"))),
            missing);
    }

    private static IXLWorksheet? Sheet(XLWorkbook workbook, string name, List<string> missing)
    {
        var ws = workbook.Worksheets.FirstOrDefault(w => w.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (ws is null) missing.Add(name);
        return ws;
    }

    private static List<T> ParseRows<T>(IXLWorksheet? ws, Func<IXLWorksheet, Dictionary<string, int>, int, T> build)
        where T : class
    {
        var rows = new List<T>();
        if (ws is null) return rows;

        var map = HeaderMap(ws);
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            if (IsRowEmpty(ws, map, r)) continue;
            rows.Add(build(ws, map, r));
        }
        return rows;
    }

    private static Dictionary<string, int> HeaderMap(IXLWorksheet ws)
    {
        var map = new Dictionary<string, int>();
        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        for (int c = 1; c <= lastCol; c++)
        {
            var name = ws.Cell(1, c).GetString().Trim();
            if (!string.IsNullOrEmpty(name))
                map[name.ToLowerInvariant()] = c;
        }
        return map;
    }

    private static bool IsRowEmpty(IXLWorksheet ws, Dictionary<string, int> map, int row) =>
        map.Values.All(c => string.IsNullOrWhiteSpace(ws.Cell(row, c).GetString()));

    private static string? Cell(IXLWorksheet ws, Dictionary<string, int> map, int row, string header)
    {
        if (!map.TryGetValue(header.ToLowerInvariant(), out var col)) return null;
        var cell = ws.Cell(row, col);

        // Read typed date/number cells with invariant formatting so the (invariant) validator can parse
        // them regardless of the server's culture. Text cells (incl. dates typed as text) pass through.
        var value = cell.DataType switch
        {
            XLDataType.DateTime => cell.GetDateTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
            XLDataType.Number => cell.GetValue<double>().ToString(CultureInfo.InvariantCulture),
            _ => cell.GetString(),
        };

        value = value.Trim();
        return string.IsNullOrEmpty(value) ? null : value;
    }
}
