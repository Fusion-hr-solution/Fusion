using System.Globalization;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Import;

/// <summary>DB-derived lookups the validator needs (all normalised to lower-case).</summary>
internal record ImportValidationContext(
    HashSet<string> CategoryNames,
    HashSet<string> ExistingTrainingKeys,
    HashSet<string> TrainerEmails);

/// <summary>
/// Validates a parsed import workbook into a preview (US-8.2.3, ADR 0008): per-training rows with a
/// status (ready / duplicate / error) and aggregated issues (including child-row issues), plus
/// workbook-level global issues. Pure — all DB facts arrive via <see cref="ImportValidationContext"/>.
/// </summary>
internal static class TrainingImportValidator
{
    public static TrainingImportPreviewDto Validate(string fileName, ParsedWorkbook wb, ImportValidationContext ctx)
    {
        var preview = new TrainingImportPreviewDto { FileName = fileName };

        foreach (var sheet in wb.MissingSheets)
        {
            preview.GlobalIssues.Add(new TrainingImportIssueDto
            {
                Message = $"Sheet '{sheet}' is missing.",
                Severity = sheet == ImportColumns.TrainingsSheet ? "error" : "warning",
            });
        }

        var refCounts = wb.Trainings
            .Where(t => !string.IsNullOrWhiteSpace(t.Ref))
            .GroupBy(t => t.Ref!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);
        var knownRefs = new HashSet<string>(refCounts.Keys, StringComparer.OrdinalIgnoreCase);

        var sessionsByRef = GroupByRef(wb.Sessions, s => s.TrainingRef);
        var chaptersByRef = GroupByRef(wb.Chapters, c => c.TrainingRef);
        var contentByRef = GroupByRef(wb.Content, c => c.TrainingRef);

        AddOrphans(preview, wb.Sessions, s => s.TrainingRef, s => s.RowNumber, ImportColumns.SessionsSheet, knownRefs);
        AddOrphans(preview, wb.Chapters, c => c.TrainingRef, c => c.RowNumber, ImportColumns.ChaptersSheet, knownRefs);
        AddOrphans(preview, wb.Content, c => c.TrainingRef, c => c.RowNumber, ImportColumns.ContentSheet, knownRefs);

        foreach (var t in wb.Trainings)
        {
            var row = new TrainingImportRowDto { Ref = t.Ref ?? "", Title = t.Title, Category = t.Category, Format = t.Format };
            var issues = row.Issues;

            if (string.IsNullOrWhiteSpace(t.Ref))
                Err(issues, "Ref", "Ref is required.");
            else if (refCounts.TryGetValue(t.Ref.Trim(), out var n) && n > 1)
                Err(issues, "Ref", $"Ref '{t.Ref.Trim()}' is used by more than one training.");

            if (string.IsNullOrWhiteSpace(t.Title))
                Err(issues, "Title", "Title is required.");
            MaxLen(issues, "Title", t.Title, 300, "Title");
            MaxLen(issues, "Description", t.Description, 2000, "Description");

            if (string.IsNullOrWhiteSpace(t.Category))
                Err(issues, "Category", "Category is required.");
            else if (!ctx.CategoryNames.Contains(t.Category.Trim().ToLowerInvariant()))
                Err(issues, "Category", $"Category '{t.Category.Trim()}' does not exist.");

            var format = ParseFormat(t.Format);
            if (string.IsNullOrWhiteSpace(t.Format))
                Err(issues, "Format", "Format is required.");
            else if (format is null)
                Err(issues, "Format", $"Format must be one of: {string.Join(", ", ImportColumns.Formats)}.");

            if (string.IsNullOrWhiteSpace(t.Credits))
                Err(issues, "Credits", "Credits is required.");
            else if (!int.TryParse(t.Credits, out var credits) || credits < 0)
                Err(issues, "Credits", "Credits must be a non-negative whole number.");

            if (string.IsNullOrWhiteSpace(t.BadgeLevel))
                Err(issues, "Badge Level", "Badge Level is required.");
            else if (!ImportColumns.BadgeLevels.Contains(t.BadgeLevel.Trim(), StringComparer.OrdinalIgnoreCase))
                Err(issues, "Badge Level", $"Badge Level must be one of: {string.Join(", ", ImportColumns.BadgeLevels)}.");

            var refKey = t.Ref?.Trim() ?? "";
            var sessions = sessionsByRef.GetValueOrDefault(refKey, []);
            var chapters = chaptersByRef.GetValueOrDefault(refKey, []);
            var content = contentByRef.GetValueOrDefault(refKey, []);
            row.SessionCount = sessions.Count;
            row.ChapterCount = chapters.Count;
            row.ContentCount = content.Count;

            if (format == "On-site" && sessions.Count == 0)
                Err(issues, null, "On-site trainings need at least one session.");
            if (format == "E-learning" && chapters.Count == 0)
                Err(issues, null, "E-learning trainings need at least one chapter.");

            ValidateSessions(issues, sessions, ctx);
            ValidateChapters(issues, chapters);
            ValidateContent(issues, content, chapters);

            var hasError = issues.Any(i => i.Severity == "error");
            var isDuplicate = !string.IsNullOrWhiteSpace(t.Title) && !string.IsNullOrWhiteSpace(t.Category)
                && ctx.ExistingTrainingKeys.Contains(Key(t.Title, t.Category));
            if (isDuplicate)
                Warn(issues, null, "A training with this title already exists in this category.");

            row.Status = hasError ? "error" : isDuplicate ? "duplicate" : "ready";
            preview.Rows.Add(row);
        }

        preview.Summary = new TrainingImportSummaryDto
        {
            Total = preview.Rows.Count,
            Ready = preview.Rows.Count(r => r.Status == "ready"),
            Duplicate = preview.Rows.Count(r => r.Status == "duplicate"),
            Error = preview.Rows.Count(r => r.Status == "error"),
        };
        return preview;
    }

    private static void ValidateSessions(List<TrainingImportIssueDto> issues, List<RawSessionRow> sessions, ImportValidationContext ctx)
    {
        foreach (var s in sessions)
        {
            var p = $"Session row {s.RowNumber}";
            if (string.IsNullOrWhiteSpace(s.PartTitle)) Err(issues, null, $"{p}: Part Title is required.");

            var hasStart = TryDate(s.Start, out var start);
            var hasEnd = TryDate(s.End, out var end);
            if (!hasStart) Err(issues, null, $"{p}: Start (UTC) is missing or not a valid date/time.");
            if (!hasEnd) Err(issues, null, $"{p}: End (UTC) is missing or not a valid date/time.");
            if (hasStart && hasEnd && end <= start) Err(issues, null, $"{p}: End must be after Start.");

            if (string.IsNullOrWhiteSpace(s.Capacity) || !int.TryParse(s.Capacity, out var cap) || cap <= 0)
                Err(issues, null, $"{p}: Capacity must be a positive whole number.");

            MaxLen(issues, null, s.PartTitle, 300, $"{p}: Part Title");
            MaxLen(issues, null, s.Room, 200, $"{p}: Room");
            MaxLen(issues, null, s.TrainerName, 200, $"{p}: Trainer Name");
            MaxLen(issues, null, s.TrainerEmail, 320, $"{p}: Trainer Email");

            if (!string.IsNullOrWhiteSpace(s.TrainerEmail)
                && !ctx.TrainerEmails.Contains(s.TrainerEmail.Trim().ToLowerInvariant()))
                Warn(issues, null, $"{p}: trainer '{s.TrainerEmail.Trim()}' is not a known employee — will be kept as an external trainer.");
        }
    }

    private static void ValidateChapters(List<TrainingImportIssueDto> issues, List<RawChapterRow> chapters)
    {
        foreach (var c in chapters)
        {
            var p = $"Chapter row {c.RowNumber}";
            if (string.IsNullOrWhiteSpace(c.Title)) Err(issues, null, $"{p}: Chapter Title is required.");
            MaxLen(issues, null, c.Title, 300, $"{p}: Chapter Title");
            if (string.IsNullOrWhiteSpace(c.Order) || !int.TryParse(c.Order, out _)) Err(issues, null, $"{p}: Order must be a whole number.");
            if (!string.IsNullOrWhiteSpace(c.Layout) && !ImportColumns.Layouts.Contains(c.Layout.Trim(), StringComparer.OrdinalIgnoreCase))
                Warn(issues, null, $"{p}: unknown Layout '{c.Layout.Trim()}' — the default will be used.");
        }
    }

    private static void ValidateContent(List<TrainingImportIssueDto> issues, List<RawContentRow> content, List<RawChapterRow> chapters)
    {
        var chapterTitles = chapters
            .Where(c => !string.IsNullOrWhiteSpace(c.Title))
            .Select(c => c.Title!.Trim().ToLowerInvariant())
            .ToHashSet();

        foreach (var c in content)
        {
            var p = $"Content row {c.RowNumber}";
            var type = ImportColumns.ContentTypes.FirstOrDefault(x => x.Equals(c.Type?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (type is null)
                Err(issues, null, $"{p}: Type must be one of: {string.Join(", ", ImportColumns.ContentTypes)}.");
            else if (type == "Article" && string.IsNullOrWhiteSpace(c.Text))
                Err(issues, null, $"{p}: Article content needs Text.");
            else if ((type is "Video" or "Pdf" or "Exercise") && string.IsNullOrWhiteSpace(c.Url))
                Err(issues, null, $"{p}: {type} content needs a URL.");

            MaxLen(issues, null, c.Title, 300, $"{p}: Title");
            MaxLen(issues, null, c.Url, 500, $"{p}: URL");

            if (!string.IsNullOrWhiteSpace(c.ChapterTitle) && chapterTitles.Count > 0
                && !chapterTitles.Contains(c.ChapterTitle.Trim().ToLowerInvariant()))
                Warn(issues, null, $"{p}: Chapter Title '{c.ChapterTitle.Trim()}' does not match any chapter of this training.");
        }
    }

    private static Dictionary<string, List<T>> GroupByRef<T>(List<T> rows, Func<T, string?> refSelector) =>
        rows.Where(r => !string.IsNullOrWhiteSpace(refSelector(r)))
            .GroupBy(r => refSelector(r)!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

    private static void AddOrphans<T>(
        TrainingImportPreviewDto preview, List<T> rows, Func<T, string?> refSelector, Func<T, int> rowNumber,
        string sheet, HashSet<string> knownRefs)
    {
        foreach (var r in rows)
        {
            var rf = refSelector(r)?.Trim();
            if (string.IsNullOrWhiteSpace(rf))
                preview.GlobalIssues.Add(new TrainingImportIssueDto
                { Message = $"{sheet} row {rowNumber(r)}: Training Ref is required.", Severity = "error" });
            else if (!knownRefs.Contains(rf))
                preview.GlobalIssues.Add(new TrainingImportIssueDto
                { Message = $"{sheet} row {rowNumber(r)}: references unknown training Ref '{rf}'.", Severity = "error" });
        }
    }

    private static string? ParseFormat(string? format)
    {
        if (string.IsNullOrWhiteSpace(format)) return null;
        var f = format.Trim();
        return ImportColumns.Formats.FirstOrDefault(x => x.Equals(f, StringComparison.OrdinalIgnoreCase));
    }

    private static bool TryDate(string? value, out DateTime end)
    {
        end = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var d))
        {
            end = d;
            return true;
        }
        return false;
    }

    private static string Key(string title, string category) =>
        $"{title.Trim().ToLowerInvariant()}|{category.Trim().ToLowerInvariant()}";

    private static void MaxLen(List<TrainingImportIssueDto> issues, string? field, string? value, int max, string label)
    {
        if (!string.IsNullOrEmpty(value) && value.Trim().Length > max)
            Err(issues, field, $"{label} must be {max} characters or fewer.");
    }

    private static void Err(List<TrainingImportIssueDto> issues, string? field, string message) =>
        issues.Add(new TrainingImportIssueDto { Field = field, Message = message, Severity = "error" });

    private static void Warn(List<TrainingImportIssueDto> issues, string? field, string message) =>
        issues.Add(new TrainingImportIssueDto { Field = field, Message = message, Severity = "warning" });
}
