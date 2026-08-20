using EY.HRPlatform.CoreHR.Infrastructure.Imports;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportSourceInspectionService
{
    Task<OrganizationSourceInspection> InspectAsync(
        Stream stream,
        string fileName,
        string? contentType,
        string? selectedSheetName,
        CancellationToken cancellationToken);
}

/// <summary>
/// Adapts the domain-neutral <see cref="ISafeTabularSourceReader"/> into the
/// Organization Import source model. All byte/workbook/CSV safety mechanics now
/// live in the shared reader; this adapter only maps the neutral result into
/// Organization-specific contracts and preserves native-template recognition so
/// a Fusion Organization workbook is auto-selected instead of prompting a sheet
/// choice. Behavior must remain equivalent to the pre-extraction inspector.
/// </summary>
public sealed class OrganizationImportSourceInspectionService(ISafeTabularSourceReader reader)
    : IOrganizationImportSourceInspectionService
{
    public const int MaxFileBytes = SafeTabularSourceReader.MaxFileBytes;

    public async Task<OrganizationSourceInspection> InspectAsync(
        Stream stream,
        string fileName,
        string? contentType,
        string? selectedSheetName,
        CancellationToken cancellationToken)
    {
        TabularSourceInspection inspection;
        try
        {
            inspection = await reader.InspectAsync(stream, fileName, contentType, selectedSheetName, cancellationToken);
        }
        catch (TabularSourceException exception)
        {
            throw new OrganizationImportSourceException(exception.Code, exception.Message, exception.StatusCode);
        }

        // The reader selects a single usable sheet automatically (CSV, a one-sheet
        // workbook, or an explicit selection). When it defers (several usable sheets,
        // no explicit choice), recognize a Fusion-native Organization sheet by its exact
        // header signature and select it directly; otherwise prompt a sheet choice.
        var selected = inspection.SelectedSheet
            ?? inspection.UsableSheets.FirstOrDefault(sheet => IsNativeOrganizationSheet(sheet.Name, sheet.Table));

        if (selected is null)
        {
            return new OrganizationSheetSelectionRequired(new OrganizationSourceChoice(
                inspection.FileName,
                inspection.Format,
                inspection.ByteLength,
                inspection.Sha256,
                inspection.UsableSheets.Select(sheet => sheet.Name).ToList()));
        }

        return new OrganizationSourceReady(new InspectedOrganizationSource(
            inspection.FileName,
            inspection.Format,
            inspection.ContentType,
            inspection.Sha256,
            selected.Name,
            selected.Range,
            ToOrganizationTable(selected.Table),
            inspection.RawBytes));
    }

    private static OrganizationSourceTable ToOrganizationTable(TabularSourceTable table)
        => new(
            table.Columns.Select(column => new OrganizationSourceColumn(column.Index, column.Label)).ToList(),
            table.Rows);

    private static bool IsNativeOrganizationSheet(string sheetName, TabularSourceTable table)
    {
        if (!sheetName.Equals(OrganizationImportWorkbookService.CanonicalSheetName, StringComparison.OrdinalIgnoreCase))
            return false;
        var expected = OrganizationImportWorkbookService.CanonicalHeaders;
        if (table.Columns.Count != expected.Length) return false;
        for (var index = 0; index < expected.Length; index++)
        {
            if (!string.Equals(table.Columns[index].Label?.Trim(), expected[index], StringComparison.OrdinalIgnoreCase))
                return false;
        }
        return true;
    }
}
