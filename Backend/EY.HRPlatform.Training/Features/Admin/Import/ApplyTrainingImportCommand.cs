using System.Globalization;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Import;

/// <summary>
/// US-8.2.3 step 4 — apply a (re-uploaded, re-validated) import workbook. Per-training atomic and
/// best-effort: each training + its children commit independently; a failure isolates to that
/// training and is logged (ADR 0008). Duplicates resolve via the per-Ref action: skip / createNew /
/// safeUpdate (non-destructive — flat fields refreshed, new children appended, nothing deleted).
/// </summary>
public record ApplyTrainingImportCommand(
    byte[] FileBytes, string FileName, Guid EmployeeId, Dictionary<string, string> DuplicateActions)
    : ICommand<Result<TrainingImportResultDto>>;

public class ApplyTrainingImportCommandHandler
    : ICommandHandler<ApplyTrainingImportCommand, Result<TrainingImportResultDto>>
{
    private readonly TrainingDbContext _db;

    public ApplyTrainingImportCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainingImportResultDto>> Handle(
        ApplyTrainingImportCommand request, CancellationToken cancellationToken)
    {
        ParsedWorkbook parsed;
        try
        {
            using var stream = new MemoryStream(request.FileBytes);
            parsed = TrainingImportParser.Parse(stream);
        }
        catch (Exception)
        {
            return Result.Failure<TrainingImportResultDto>(
                Error.Validation("Import.InvalidFile", "The file could not be read as an .xlsx workbook."));
        }

        // Lookups (re-derived, so apply re-validates against the current DB).
        var categoryByName = await _db.Categories.AsNoTracking()
            .Select(c => new { c.Id, c.Name })
            .ToListAsync(cancellationToken);
        var categoryNameToId = categoryByName
            .GroupBy(c => c.Name.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First().Id);
        var categoryNames = categoryNameToId.Keys.ToHashSet();

        var existing = await _db.Trainings.AsNoTracking()
            .Where(t => !t.IsDeleted)
            .Select(t => new { t.Id, t.Title, CategoryName = t.Category.Name })
            .ToListAsync(cancellationToken);
        var existingKeyToId = existing
            .GroupBy(x => Key(x.Title, x.CategoryName))
            .ToDictionary(g => g.Key, g => g.First().Id);
        var existingKeys = existingKeyToId.Keys.ToHashSet();

        var trainerProfiles = await _db.EmployeeProfiles.AsNoTracking()
            .Where(e => e.Email != null)
            .Select(e => new { e.EmployeeId, Email = e.Email! })
            .ToListAsync(cancellationToken);
        var emailToId = trainerProfiles
            .GroupBy(e => e.Email.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First().EmployeeId);

        var ctx = new ImportValidationContext(categoryNames, existingKeys, emailToId.Keys.ToHashSet());
        var preview = TrainingImportValidator.Validate(request.FileName, parsed, ctx);

        var sessionsByRef = GroupByRef(parsed.Sessions, s => s.TrainingRef);
        var chaptersByRef = GroupByRef(parsed.Chapters, c => c.TrainingRef);
        var contentByRef = GroupByRef(parsed.Content, c => c.TrainingRef);

        var result = new TrainingImportResultDto();

        // preview.Rows is index-aligned with parsed.Trainings (both built in workbook order).
        for (int i = 0; i < parsed.Trainings.Count; i++)
        {
            var raw = parsed.Trainings[i];
            var pv = preview.Rows[i];
            var refKey = raw.Ref?.Trim() ?? "";

            if (pv.Status == "error")
            {
                result.Failed++;
                result.Errors.Add(new TrainingImportErrorDto
                {
                    Ref = refKey,
                    Title = raw.Title,
                    Message = pv.Issues.FirstOrDefault(x => x.Severity == "error")?.Message ?? "Validation failed.",
                });
                continue;
            }

            var action = pv.Status == "duplicate" ? request.DuplicateActions.GetValueOrDefault(refKey, "skip") : "create";
            if (action == "skip")
            {
                result.Skipped++;
                continue;
            }

            var sessions = sessionsByRef.GetValueOrDefault(refKey, []);
            var chapters = chaptersByRef.GetValueOrDefault(refKey, []);
            var content = contentByRef.GetValueOrDefault(refKey, []);

            try
            {
                if (action == "safeUpdate")
                {
                    await SafeUpdateAsync(raw, sessions, chapters, content, existingKeyToId, emailToId, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);
                    result.Updated++;
                }
                else // "create" (ready) or "createNew" (duplicate, keep both)
                {
                    Create(raw, sessions, chapters, content, categoryNameToId, emailToId);
                    await _db.SaveChangesAsync(cancellationToken);
                    result.Imported++;
                }
            }
            catch (Exception)
            {
                _db.ChangeTracker.Clear(); // discard this training's pending graph; keep prior commits
                result.Failed++;
                result.Errors.Add(new TrainingImportErrorDto
                {
                    Ref = refKey,
                    Title = raw.Title,
                    Message = "This training could not be imported due to an unexpected error.",
                });
            }
        }

        // Audit row is best-effort — a failure here must not turn a successful import into an error.
        try
        {
            var fileName = request.FileName.Length > 260 ? request.FileName[..260] : request.FileName;
            _db.TrainingImportHistories.Add(new TrainingImportHistory(
                request.EmployeeId, fileName, result.Imported, result.Updated, result.Skipped, result.Failed));
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception)
        {
            _db.ChangeTracker.Clear();
        }

        return Result.Success(result);
    }

    private void Create(
        RawTrainingRow raw, List<RawSessionRow> sessions, List<RawChapterRow> chapters, List<RawContentRow> content,
        Dictionary<string, Guid> categoryNameToId, Dictionary<string, Guid> emailToId)
    {
        var categoryId = categoryNameToId[raw.Category!.Trim().ToLowerInvariant()];
        Enum.TryParse<BadgeLevel>(raw.BadgeLevel, true, out var badge);
        var type = string.Equals(raw.Format?.Trim(), "On-site", StringComparison.OrdinalIgnoreCase)
            ? TrainingType.OnSite
            : TrainingType.ELearning;

        var training = new TrainingCourse(
            raw.Title!.Trim(),
            raw.Description,
            ParseInt(raw.Credits),
            ParseBool(raw.Mandatory),
            badge,
            categoryId,
            raw.Duration,
            type);

        _db.Trainings.Add(training);
        AddChildren(training, sessions, chapters, content, emailToId, chapterOrderOffset: 0, partOrderOffset: 0);
    }

    private async Task SafeUpdateAsync(
        RawTrainingRow raw, List<RawSessionRow> sessions, List<RawChapterRow> chapters, List<RawContentRow> content,
        Dictionary<string, Guid> existingKeyToId, Dictionary<string, Guid> emailToId, CancellationToken cancellationToken)
    {
        var id = existingKeyToId[Key(raw.Title!, raw.Category!)];
        var training = await _db.Trainings.FirstAsync(t => t.Id == id, cancellationToken);

        Enum.TryParse<BadgeLevel>(raw.BadgeLevel, true, out var badge);
        // Flat fields only — category, format, enrollments and existing children are left untouched.
        training.Update(raw.Title!.Trim(), raw.Description, ParseInt(raw.Credits), ParseBool(raw.Mandatory), badge, raw.Duration);

        // Append new children past the existing max OrderIndex so they never collide with existing ones.
        var chapterOffset = (await _db.Set<TrainingChapter>().AsNoTracking()
            .Where(c => c.TrainingId == id).Select(c => (int?)c.OrderIndex).MaxAsync(cancellationToken) ?? -1) + 1;
        var partOffset = (await _db.Set<TrainingPart>().AsNoTracking()
            .Where(p => p.TrainingId == id).Select(p => (int?)p.OrderIndex).MaxAsync(cancellationToken) ?? -1) + 1;

        AddChildren(training, sessions, chapters, content, emailToId, chapterOffset, partOffset);
    }

    private void AddChildren(
        TrainingCourse training, List<RawSessionRow> sessions, List<RawChapterRow> chapters, List<RawContentRow> content,
        Dictionary<string, Guid> emailToId, int chapterOrderOffset, int partOrderOffset)
    {
        // E-learning branch: chapters + their content blocks. OrderIndex is assigned sequentially (sorted
        // by the sheet's Order for intent) so it is always unique — the sheet's Order may be blank/duplicate.
        if (chapters.Count > 0)
        {
            var contentByChapter = content
                .Where(c => !string.IsNullOrWhiteSpace(c.ChapterTitle))
                .GroupBy(c => c.ChapterTitle!.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

            var orderedChapters = chapters.OrderBy(c => ParseInt(c.Order)).ToList();
            for (int ci = 0; ci < orderedChapters.Count; ci++)
            {
                var ch = orderedChapters[ci];
                Enum.TryParse<ChapterLayout>(ch.Layout, true, out var layout);
                var chapter = new TrainingChapter(ch.Title!.Trim(), layout, chapterOrderOffset + ci, training.Id);

                if (ch.Title is not null && contentByChapter.TryGetValue(ch.Title.Trim(), out var blocks))
                {
                    var orderedBlocks = blocks.OrderBy(b => ParseInt(b.Order)).ToList();
                    for (int bi = 0; bi < orderedBlocks.Count; bi++)
                    {
                        var block = orderedBlocks[bi];
                        if (!Enum.TryParse<ContentType>(block.Type, true, out var contentType)) continue;
                        chapter.AddContentBlock(new ContentBlock(
                            contentType,
                            bi,
                            chapter.Id,
                            block.Title,
                            textContent: contentType == ContentType.Article ? block.Text : null,
                            contentUri: contentType is ContentType.Pdf or ContentType.Exercise ? block.Url : null,
                            videoUrl: contentType == ContentType.Video ? block.Url : null,
                            estimatedDurationMinutes: ParseNullableInt(block.DurationMin)));
                    }
                }

                training.AddChapter(chapter);
            }
        }

        // On-site branch: one part per distinct Part Title (first-seen order), with its sessions.
        if (sessions.Count > 0)
        {
            var partOrder = partOrderOffset;
            foreach (var group in sessions
                .Where(s => !string.IsNullOrWhiteSpace(s.PartTitle))
                .GroupBy(s => s.PartTitle!.Trim(), StringComparer.OrdinalIgnoreCase))
            {
                var rows = group.ToList();
                var hours = rows.Sum(s => SessionHours(s.Start, s.End));
                var part = new TrainingPart(training.Id, group.Key, null, partOrder++, (decimal)hours);
                _db.TrainingParts.Add(part);

                foreach (var s in rows)
                {
                    var (trainerId, trainerEmail, trainerName) = ResolveTrainer(s, emailToId);
                    _db.TrainingSessions.Add(new TrainingSession(
                        part.Id,
                        ParseDate(s.Start),
                        ParseDate(s.End),
                        s.Room ?? string.Empty,
                        ParseInt(s.Capacity),
                        notes: null,
                        trainerId,
                        trainerName,
                        trainerEmail));
                }
            }
        }
    }

    private static (Guid? Id, string? Email, string? Name) ResolveTrainer(RawSessionRow s, Dictionary<string, Guid> emailToId)
    {
        if (!string.IsNullOrWhiteSpace(s.TrainerEmail))
        {
            var email = s.TrainerEmail.Trim();
            if (emailToId.TryGetValue(email.ToLowerInvariant(), out var id))
                return (id, email, s.TrainerName); // internal trainer
            return (null, email, s.TrainerName);   // external (email not a known employee)
        }
        return (null, null, s.TrainerName);        // external by name only
    }

    private static double SessionHours(string? start, string? end)
    {
        if (TryDate(start, out var s) && TryDate(end, out var e) && e > s)
            return Math.Round((e - s).TotalHours, 2);
        return 0;
    }

    private static Dictionary<string, List<T>> GroupByRef<T>(List<T> rows, Func<T, string?> refSelector) =>
        rows.Where(r => !string.IsNullOrWhiteSpace(refSelector(r)))
            .GroupBy(r => refSelector(r)!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

    private static int ParseInt(string? value) => int.TryParse(value, out var n) ? n : 0;

    private static int? ParseNullableInt(string? value) => int.TryParse(value, out var n) ? n : null;

    private static bool ParseBool(string? value) =>
        value is not null && value.Trim() is var v
        && (v.Equals("yes", StringComparison.OrdinalIgnoreCase)
            || v.Equals("true", StringComparison.OrdinalIgnoreCase)
            || v == "1");

    private static DateTime ParseDate(string? value) => TryDate(value, out var d) ? d : DateTime.UtcNow;

    private static bool TryDate(string? value, out DateTime date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var d))
        {
            date = d;
            return true;
        }
        return false;
    }

    private static string Key(string title, string category) =>
        $"{title.Trim().ToLowerInvariant()}|{category.Trim().ToLowerInvariant()}";
}
