using EY.HRPlatform.CoreHR.Infrastructure.Imports;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>
/// Adapts a domain-neutral <see cref="TabularSourceInspection"/> into the Workforce Import
/// source model: the selected sheet's column labels and per-row source cells, ready to be
/// persisted as one temporary <see cref="WorkforceImportRow"/> per source data row. Structural
/// decisions the safe reader already makes (single selected table, leading-blank handling,
/// visible-sheet enumeration, fidelity-preserving cell text) are honored here; deeper header-row
/// ambiguity and combined-name/date interpretation are the interpreter's concern.
/// </summary>
public sealed class WorkforceImportSourceAdapter
{
    private const int HeaderScanRows = 6;
    private const int MinHeaderScore = 2;
    private const int PreviewCells = 8;

    public WorkforceImportSourceShape Adapt(TabularSourceInspection inspection, int? headerRowIndex = null)
    {
        var sheets = inspection.UsableSheets
            .Select(sheet => new WorkforceImportSheetSummary(sheet.Name, sheet.RowCount, sheet.ColumnCount))
            .ToList();

        if (inspection.SelectedSheet is null)
            return new WorkforceImportSourceShape(true, false, sheets, null, []);

        var sheet = inspection.SelectedSheet;
        // The full row sequence including the reader's row-0 labels, so a later row can be chosen as
        // the header when a source has leading title rows.
        var full = new List<IReadOnlyList<string?>>(sheet.Table.Rows.Count + 1)
        {
            sheet.Table.Columns.Select(column => column.Label).ToList(),
        };
        full.AddRange(sheet.Table.Rows);

        var candidates = DetectHeaderCandidates(full);
        var chosenHeader = headerRowIndex ?? (candidates.Count > 1 ? (int?)null : candidates.FirstOrDefault());

        if (chosenHeader is null)
        {
            var previews = candidates
                .Select(index => new WorkforceHeaderCandidate(index, Preview(full[index])))
                .ToList();
            return new WorkforceImportSourceShape(false, true, sheets, null, previews);
        }

        var headerIndex = Math.Clamp(chosenHeader.Value, 0, full.Count - 1);
        var columns = full[headerIndex].Select(cell => cell?.Trim()).ToList();
        var columnsJson = WorkforceImportJson.Serialize(columns);

        var rows = new List<WorkforceImportSourceRowCells>();
        var sourceRowNumber = 0;
        for (var index = headerIndex + 1; index < full.Count; index++)
        {
            sourceRowNumber++;
            rows.Add(new WorkforceImportSourceRowCells(sourceRowNumber, WorkforceImportJson.Serialize(full[index])));
        }

        return new WorkforceImportSourceShape(
            false, false, sheets,
            new WorkforceImportSelectedSheet(sheet.Name, sheet.Range, columns.Count, rows.Count, columnsJson, rows),
            []);
    }

    /// <summary>
    /// Returns the plausible header-row indexes. When exactly one row is confidently the header the
    /// list has one entry (auto-proceed); when several early rows look equally like headers the list
    /// has more than one and the caller must ask the administrator to choose. This is header-row
    /// disambiguation only — not a general spreadsheet header editor.
    /// </summary>
    private static IReadOnlyList<int> DetectHeaderCandidates(IReadOnlyList<IReadOnlyList<string?>> full)
    {
        var scan = Math.Min(HeaderScanRows, full.Count);
        var scored = Enumerable.Range(0, scan)
            .Select(index => (Index: index, Score: WorkforceImportInterpreter.CountMappableColumns(full[index])))
            .ToList();
        var best = scored.Max(s => s.Score);
        if (best < MinHeaderScore)
            return [0]; // nothing looks like a header; fall back to the first row deterministically.
        var plausible = scored.Where(s => s.Score >= best - 1 && s.Score >= MinHeaderScore).Select(s => s.Index).ToList();
        return plausible.Count == 0 ? [0] : plausible;
    }

    private static IReadOnlyList<string?> Preview(IReadOnlyList<string?> row)
        => row.Take(PreviewCells).Select(cell => cell?.Trim()).ToList();
}

public sealed record WorkforceImportSheetSummary(string Name, int RowCount, int ColumnCount);

public sealed record WorkforceImportSourceRowCells(int SourceRowNumber, string CellsJson);

public sealed record WorkforceImportSelectedSheet(
    string Name,
    string Range,
    int ColumnCount,
    int RowCount,
    string ColumnsJson,
    IReadOnlyList<WorkforceImportSourceRowCells> Rows);

public sealed record WorkforceHeaderCandidate(int RowIndex, IReadOnlyList<string?> Preview);

public sealed record WorkforceImportSourceShape(
    bool SheetSelectionRequired,
    bool HeaderClarificationRequired,
    IReadOnlyList<WorkforceImportSheetSummary> Sheets,
    WorkforceImportSelectedSheet? Selected,
    IReadOnlyList<WorkforceHeaderCandidate> HeaderCandidates);
