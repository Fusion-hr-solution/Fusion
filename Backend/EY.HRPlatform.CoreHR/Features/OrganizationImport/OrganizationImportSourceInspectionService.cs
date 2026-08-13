using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

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

public sealed class OrganizationImportSourceInspectionService : IOrganizationImportSourceInspectionService
{
    public const int MaxFileBytes = 10 * 1024 * 1024;
    private const int MaxRows = 10_000;
    private const int MaxColumns = 256;
    private const int MaxCellCharacters = 32_767;
    private const int MaxRetainedTextBytes = 25 * 1024 * 1024;
    private const int MaxPackageEntries = 1_024;
    private const long MaxExpandedBytes = 100L * 1024 * 1024;
    private const long MaxEntryBytes = 50L * 1024 * 1024;
    private const double MaxCompressionRatio = 100d;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    public async Task<OrganizationSourceInspection> InspectAsync(
        Stream stream,
        string fileName,
        string? contentType,
        string? selectedSheetName,
        CancellationToken cancellationToken)
    {
        var safeName = SanitizeFileName(fileName);
        var extension = Path.GetExtension(safeName).ToLowerInvariant();
        if (extension is not (".csv" or ".xlsx"))
            throw Rejected("UnsupportedFormat", "Choose a CSV or XLSX file.");

        var bytes = await ReadBoundedAsync(stream, cancellationToken);
        if (bytes.Length == 0) throw Rejected("Empty", "The selected file is empty.");
        var sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes));

        try
        {
            return extension == ".csv"
                ? InspectCsv(bytes, safeName, contentType, sha256)
                : InspectWorkbook(bytes, safeName, contentType, sha256, selectedSheetName);
        }
        catch (OrganizationImportSourceException)
        {
            throw;
        }
        catch (OpenXmlPackageException)
        {
            throw Rejected("Unreadable", "Fusion could not read this workbook.");
        }
        catch (InvalidDataException)
        {
            throw Rejected("Unreadable", "Fusion could not read this file.");
        }
        catch (CsvHelperException)
        {
            throw Rejected("Unreadable", "Fusion could not read this CSV.");
        }
        catch (DecoderFallbackException)
        {
            throw Rejected("Unreadable", "Fusion could not read this CSV as UTF-8 text.");
        }
    }

    private static OrganizationSourceInspection InspectCsv(
        byte[] bytes,
        string fileName,
        string? contentType,
        string sha256)
    {
        if (LooksLikeZip(bytes) || LooksLikeCompoundFile(bytes))
            throw Rejected("SignatureMismatch", "The file contents do not match its CSV extension.");

        var text = StrictUtf8.GetString(bytes);
        using var reader = new StringReader(text);
        var configuration = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            DetectDelimiter = true,
            DetectDelimiterValues = [",", ";", "\t"],
            BadDataFound = _ => throw Rejected("Unreadable", "Fusion could not read this CSV."),
            MissingFieldFound = null,
            TrimOptions = TrimOptions.None,
        };
        using var csv = new CsvReader(reader, configuration);
        var records = new List<(int RowNumber, IReadOnlyList<string?> Cells)>();
        var rowNumber = 0;
        while (csv.Read())
        {
            rowNumber++;
            var cells = (csv.Parser.Record ?? []).Select(NormalizeCell).ToArray();
            if (cells.Length > MaxColumns) throw Rejected("ColumnLimitExceeded", "The file has more than 256 columns.");
            if (cells.Any(value => value is not null)) records.Add((rowNumber, cells));
            if (records.Count > MaxRows + 1) throw Rejected("RowLimitExceeded", "The file has more than 10,000 data rows.");
        }

        var table = BuildTable(records);
        EnsureRetainedTextBound(table);
        return new OrganizationSourceReady(new InspectedOrganizationSource(
            fileName,
            "csv",
            NormalizeContentType(contentType, "text/csv"),
            sha256,
            "CSV",
            $"A{records[0].RowNumber}:{ColumnName(table.Columns.Count)}{records[^1].RowNumber}",
            table,
            bytes));
    }

    private static OrganizationSourceInspection InspectWorkbook(
        byte[] bytes,
        string fileName,
        string? contentType,
        string sha256,
        string? selectedSheetName)
    {
        if (LooksLikeCompoundFile(bytes))
            throw Rejected("PasswordProtected", "Password-protected workbooks are not supported.");
        if (!LooksLikeZip(bytes))
            throw Rejected("SignatureMismatch", "The file contents do not match its XLSX extension.");

        PreflightPackage(bytes);
        using var stream = new MemoryStream(bytes, writable: false);
        using var document = SpreadsheetDocument.Open(stream, false, new OpenSettings { AutoSave = false });
        var workbookPart = document.WorkbookPart ?? throw Rejected("Unreadable", "Fusion could not read this workbook.");
        var workbook = workbookPart.Workbook ?? throw Rejected("Unreadable", "Fusion could not read this workbook.");
        RejectUnsafeRelationships(workbookPart);
        var sharedStrings = ReadSharedStrings(workbookPart.SharedStringTablePart);
        var candidates = new List<(string Name, OrganizationSourceTable Table, string Range)>();

        var sheets = workbook.Sheets?.Elements<Sheet>() ?? Enumerable.Empty<Sheet>();
        foreach (var sheet in sheets)
        {
            if (sheet.State?.Value == SheetStateValues.Hidden || sheet.State?.Value == SheetStateValues.VeryHidden) continue;
            if (sheet.Id?.Value is not string relationshipId || string.IsNullOrWhiteSpace(sheet.Name?.Value)) continue;
            if (workbookPart.GetPartById(relationshipId) is not WorksheetPart worksheetPart) continue;
            var inspected = ReadWorksheet(worksheetPart, sharedStrings);
            if (inspected is not null) candidates.Add((sheet.Name!.Value!, inspected.Value.Table, inspected.Value.Range));
        }

        if (candidates.Count == 0) throw Rejected("NoUsableTable", "The workbook does not contain a usable visible table.");

        // A Fusion-native template/export pairs the canonical Organization sheet with
        // support sheets such as "Type values". Recognize that contract by the
        // Organization sheet's exact header signature and select it directly, so a
        // support sheet is never mistaken for a second data sheet and never turns
        // intake into a sheet-chooser prompt. A shared "Organization" name alone is
        // not enough — the header signature is what identifies a genuine native file.
        var nativeOrganization = candidates.FirstOrDefault(candidate => IsNativeOrganizationSheet(candidate.Name, candidate.Table));
        var isNative = nativeOrganization != default;

        if (selectedSheetName is null && candidates.Count > 1 && !isNative)
        {
            return new OrganizationSheetSelectionRequired(new OrganizationSourceChoice(
                fileName, "xlsx", bytes.LongLength, sha256, candidates.Select(candidate => candidate.Name).ToList()));
        }

        var selected = selectedSheetName is not null
            ? candidates.FirstOrDefault(candidate => candidate.Name.Equals(selectedSheetName, StringComparison.Ordinal))
            : isNative
                ? nativeOrganization
                : candidates[0];
        if (selected == default) throw Rejected("InvalidSheetSelection", "Choose one of the available worksheets.");

        EnsureRetainedTextBound(selected.Table);
        return new OrganizationSourceReady(new InspectedOrganizationSource(
            fileName,
            "xlsx",
            NormalizeContentType(contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            sha256,
            selected.Name,
            selected.Range,
            selected.Table,
            bytes));
    }

    private static bool IsNativeOrganizationSheet(string sheetName, OrganizationSourceTable table)
    {
        if (!sheetName.Equals(OrganizationImportWorkbookService.CanonicalSheetName, StringComparison.OrdinalIgnoreCase))
            return false;
        var expected = OrganizationImportWorkbookService.CanonicalHeaders;
        if (table.Columns.Count != expected.Length) return false;
        for (var index = 0; index < expected.Length; index++)
        {
            if (!string.Equals(table.Columns[index].SourceLabel?.Trim(), expected[index], StringComparison.OrdinalIgnoreCase))
                return false;
        }
        return true;
    }

    private static (OrganizationSourceTable Table, string Range)? ReadWorksheet(
        WorksheetPart worksheetPart,
        IReadOnlyList<string> sharedStrings)
    {
        var records = new List<(int RowNumber, IReadOnlyList<string?> Cells)>();
        using var reader = OpenXmlReader.Create(worksheetPart);
        while (reader.Read())
        {
            if (reader.ElementType != typeof(Row) || !reader.IsStartElement) continue;
            if (reader.LoadCurrentElement() is not Row row) continue;
            var rowNumber = checked((int)(row.RowIndex?.Value ?? (uint)(records.Count + 1)));
            var cells = new List<string?>();
            var fallbackColumn = 0;
            foreach (var cell in row.Elements<Cell>())
            {
                var index = CellColumnIndex(cell.CellReference?.Value) ?? fallbackColumn;
                if (index >= MaxColumns) throw Rejected("ColumnLimitExceeded", "The file has more than 256 columns.");
                while (cells.Count <= index) cells.Add(null);
                cells[index] = ReadCell(cell, sharedStrings);
                fallbackColumn = index + 1;
            }

            while (cells.Count > 0 && cells[^1] is null) cells.RemoveAt(cells.Count - 1);
            if (cells.Any(value => value is not null)) records.Add((rowNumber, cells));
            if (records.Count > MaxRows + 1) throw Rejected("RowLimitExceeded", "The file has more than 10,000 data rows.");
        }

        if (records.Count < 2) return null;
        OrganizationSourceTable table;
        try { table = BuildTable(records); }
        catch (OrganizationImportSourceException exception) when (exception.Code is "Empty" or "NoUsableTable") { return null; }
        return (table, $"A{records[0].RowNumber}:{ColumnName(table.Columns.Count)}{records[^1].RowNumber}");
    }

    private static OrganizationSourceTable BuildTable(IReadOnlyList<(int RowNumber, IReadOnlyList<string?> Cells)> records)
    {
        if (records.Count < 2) throw Rejected("Empty", "The file needs a label row and at least one data row.");
        var width = records.Max(record => record.Cells.Count);
        if (width == 0 || !records[0].Cells.Any(value => !string.IsNullOrWhiteSpace(value)))
            throw Rejected("NoUsableTable", "The source label row needs at least one label.");
        if (width > MaxColumns) throw Rejected("ColumnLimitExceeded", "The file has more than 256 columns.");
        var columns = Enumerable.Range(0, width)
            .Select(index => new OrganizationSourceColumn(index, index < records[0].Cells.Count ? records[0].Cells[index] : null))
            .ToList();
        var rows = records.Skip(1).Select(record =>
            (IReadOnlyList<string?>)Enumerable.Range(0, width)
                .Select(index => index < record.Cells.Count ? record.Cells[index] : null)
                .ToList()).ToList();
        if (rows.Count > MaxRows) throw Rejected("RowLimitExceeded", "The file has more than 10,000 data rows.");
        return new OrganizationSourceTable(columns, rows);
    }

    private static string? ReadCell(Cell cell, IReadOnlyList<string> sharedStrings)
    {
        string? raw;
        if (cell.CellFormula is not null)
        {
            var formula = cell.CellFormula.Text;
            if (formula.Contains('|') && formula.Contains('!'))
                throw Rejected("UnsafeWorkbookContent", "The workbook contains unsupported active or external content.");
            raw = cell.CellValue?.Text;
        }
        else if (cell.DataType?.Value == CellValues.SharedString)
        {
            raw = int.TryParse(cell.CellValue?.Text, out var index) && index >= 0 && index < sharedStrings.Count
                ? sharedStrings[index]
                : null;
        }
        else if (cell.DataType?.Value == CellValues.InlineString)
        {
            raw = cell.InlineString?.InnerText;
        }
        else if (cell.DataType?.Value == CellValues.Boolean)
        {
            raw = cell.CellValue?.Text == "1" ? "TRUE" : cell.CellValue?.Text == "0" ? "FALSE" : null;
        }
        else
        {
            raw = cell.CellValue?.Text;
        }
        return NormalizeCell(raw);
    }

    private static IReadOnlyList<string> ReadSharedStrings(SharedStringTablePart? part)
    {
        if (part is null) return [];
        var values = new List<string>();
        using var reader = OpenXmlReader.Create(part);
        while (reader.Read())
        {
            if (reader.ElementType == typeof(SharedStringItem) && reader.IsStartElement)
            {
                if (reader.LoadCurrentElement() is SharedStringItem item) values.Add(item.InnerText);
            }
        }
        return values;
    }

    private static void PreflightPackage(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes, writable: false);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);
        if (archive.Entries.Count > MaxPackageEntries) throw Rejected("PackageLimitExceeded", "The workbook package is too complex.");
        long expanded = 0;
        foreach (var entry in archive.Entries)
        {
            expanded = checked(expanded + entry.Length);
            if (entry.Length > MaxEntryBytes || expanded > MaxExpandedBytes)
                throw Rejected("PackageLimitExceeded", "The expanded workbook is too large.");
            if (entry.Length > 0 && (entry.CompressedLength == 0 || entry.Length / (double)entry.CompressedLength > MaxCompressionRatio))
                throw Rejected("PackageLimitExceeded", "The workbook compression ratio is unsafe.");
            var name = entry.FullName.Replace('\\', '/').ToLowerInvariant();
            if (name.Contains("vbaproject") || name.Contains("/embeddings/") || name.Contains("/oleobjects/")
                || name.Contains("externallinks") || name.Contains("connections"))
                throw Rejected("UnsafeWorkbookContent", "The workbook contains unsupported active or external content.");
            if (name.EndsWith(".rels", StringComparison.Ordinal))
            {
                using var relReader = new StreamReader(entry.Open(), Encoding.UTF8, true, 1024, leaveOpen: false);
                var relationships = relReader.ReadToEnd();
                if (relationships.Contains("TargetMode=\"External\"", StringComparison.OrdinalIgnoreCase))
                    throw Rejected("UnsafeWorkbookContent", "The workbook contains unsupported active or external content.");
            }
        }
    }

    private static void RejectUnsafeRelationships(WorkbookPart workbookPart)
    {
        if (workbookPart.ExternalRelationships.Any() || workbookPart.HyperlinkRelationships.Any(relationship => relationship.IsExternal))
            throw Rejected("UnsafeWorkbookContent", "The workbook contains unsupported active or external content.");
        foreach (var part in workbookPart.Parts.Select(item => item.OpenXmlPart))
            if (part.ExternalRelationships.Any())
                throw Rejected("UnsafeWorkbookContent", "The workbook contains unsupported active or external content.");
    }

    private static async Task<byte[]> ReadBoundedAsync(Stream source, CancellationToken cancellationToken)
    {
        await using var target = new MemoryStream();
        var buffer = new byte[64 * 1024];
        while (true)
        {
            var read = await source.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            if (target.Length + read > MaxFileBytes)
                throw new OrganizationImportSourceException("FileTooLarge", "Choose a file smaller than 10 MB.", StatusCodes.Status413PayloadTooLarge);
            await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
        return target.ToArray();
    }

    private static void EnsureRetainedTextBound(OrganizationSourceTable table)
    {
        long size = 0;
        foreach (var value in table.Columns.Select(column => column.SourceLabel).Concat(table.Rows.SelectMany(row => row)))
        {
            if (value is null) continue;
            size += Encoding.UTF8.GetByteCount(value);
            if (size > MaxRetainedTextBytes) throw Rejected("TextLimitExceeded", "The file contains too much source text.");
        }
    }

    private static string? NormalizeCell(string? value)
    {
        if (value is null) return null;
        if (value.Length > MaxCellCharacters) throw Rejected("CellLimitExceeded", "A cell exceeds the 32,767 character limit.");
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string SanitizeFileName(string fileName)
    {
        var safe = Path.GetFileName(fileName).Trim();
        safe = new string(safe.Where(character => !char.IsControl(character)).ToArray());
        if (string.IsNullOrWhiteSpace(safe)) safe = "organization-source";
        return safe[..Math.Min(safe.Length, 255)];
    }

    private static string NormalizeContentType(string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim()[..Math.Min(value.Trim().Length, 128)];

    private static bool LooksLikeZip(byte[] bytes)
        => bytes.Length >= 4 && bytes[0] == 0x50 && bytes[1] == 0x4B
            && bytes[2] is 0x03 or 0x05 or 0x07 && bytes[3] is 0x04 or 0x06 or 0x08;

    private static bool LooksLikeCompoundFile(byte[] bytes)
        => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 });

    private static int? CellColumnIndex(string? reference)
    {
        if (string.IsNullOrWhiteSpace(reference)) return null;
        var value = 0;
        var consumed = false;
        foreach (var character in reference)
        {
            if (!char.IsLetter(character)) break;
            consumed = true;
            value = checked(value * 26 + char.ToUpperInvariant(character) - 'A' + 1);
        }
        return consumed ? value - 1 : null;
    }

    private static string ColumnName(int count)
    {
        var value = count;
        var result = string.Empty;
        while (value > 0)
        {
            value--;
            result = (char)('A' + value % 26) + result;
            value /= 26;
        }
        return result;
    }

    private static OrganizationImportSourceException Rejected(string code, string message)
        => new(code, message);
}
