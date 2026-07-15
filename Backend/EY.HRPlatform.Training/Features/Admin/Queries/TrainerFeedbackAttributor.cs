using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>One learner feedback attributed to a single trainer (ADR 0006 attribution rule).</summary>
internal record AttributedFeedback(
    string TrainerKey,
    string TrainerName,
    Guid EmployeeId,
    Guid TrainingId,
    string TrainingTitle,
    int OverallRating,
    int TrainerRating,
    bool WouldRecommend,
    string? Comment,
    bool IsAnonymous,
    DateTime SubmittedAt);

/// <summary>
/// Attributes on-site feedback to trainers per ADR 0006: a feedback's trainer rating counts for a
/// trainer only when the learner's attended sessions in that training had exactly ONE distinct
/// trainer. Multi-trainer trainings are excluded from per-trainer views.
/// </summary>
internal static class TrainerFeedbackAttributor
{
    public static async Task<List<AttributedFeedback>> AttributeAsync(
        TrainingDbContext db, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var fq = db.TrainingFeedbacks.AsNoTracking().Where(f => f.TrainerRating != null);
        if (from.HasValue) fq = fq.Where(f => f.SubmittedAt >= from.Value);
        if (to.HasValue) fq = fq.Where(f => f.SubmittedAt <= to.Value);

        var feedbacks = await fq
            .Select(f => new
            {
                f.EmployeeId,
                f.TrainingId,
                f.OverallRating,
                TrainerRating = f.TrainerRating!.Value,
                f.WouldRecommend,
                f.Comment,
                f.IsAnonymous,
                f.SubmittedAt,
            })
            .ToListAsync(ct);

        if (feedbacks.Count == 0)
            return [];

        var employeeIds = feedbacks.Select(f => f.EmployeeId).Distinct().ToList();
        var trainingIds = feedbacks.Select(f => f.TrainingId).Distinct().ToList();

        // The employees' attended sessions in those trainings, with each session's trainer.
        var attended = await db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.Status == EnrollmentStatus.Attended
                && employeeIds.Contains(e.EmployeeId)
                && trainingIds.Contains(e.Session.Part.TrainingId))
            .Select(e => new
            {
                e.EmployeeId,
                TrainingId = e.Session.Part.TrainingId,
                e.Session.TrainerEmployeeId,
                e.Session.TrainerName,
                e.Session.TrainerEmail,
            })
            .ToListAsync(ct);

        var titleById = (await db.Trainings
                .AsNoTracking()
                .Where(t => trainingIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Title })
                .ToListAsync(ct))
            .ToDictionary(t => t.Id, t => t.Title);

        // Display names for internal trainers come from their EmployeeProfile.
        var trainerEmployeeIds = attended
            .Where(a => a.TrainerEmployeeId.HasValue)
            .Select(a => a.TrainerEmployeeId!.Value)
            .Distinct()
            .ToList();
        var nameByEmployee = (await db.EmployeeProfiles
                .AsNoTracking()
                .Where(p => trainerEmployeeIds.Contains(p.EmployeeId) && p.FullName != null)
                .Select(p => new { p.EmployeeId, p.FullName })
                .ToListAsync(ct))
            .ToDictionary(p => p.EmployeeId, p => p.FullName!);

        string Display(Guid? id, string? name, string? email) =>
            id.HasValue && nameByEmployee.TryGetValue(id.Value, out var full)
                ? full
                : !string.IsNullOrWhiteSpace(name) ? name! : email ?? "Unknown trainer";

        // (employee, training) → distinct trainers the learner was taught by.
        var trainersByPair = attended
            .GroupBy(a => (a.EmployeeId, a.TrainingId))
            .ToDictionary(
                g => g.Key,
                g => g
                    .Select(a => new
                    {
                        Key = FeedbackAnalytics.TrainerKey(a.TrainerEmployeeId, a.TrainerEmail, a.TrainerName),
                        Name = Display(a.TrainerEmployeeId, a.TrainerName, a.TrainerEmail),
                    })
                    .GroupBy(x => x.Key)
                    .Select(x => x.First())
                    .ToList());

        var result = new List<AttributedFeedback>();
        foreach (var f in feedbacks)
        {
            if (!trainersByPair.TryGetValue((f.EmployeeId, f.TrainingId), out var trainers) || trainers.Count != 1)
                continue; // 0 trainers (no attended session) or multi-trainer → excluded per ADR 0006

            var trainer = trainers[0];
            result.Add(new AttributedFeedback(
                trainer.Key,
                trainer.Name,
                f.EmployeeId,
                f.TrainingId,
                titleById.GetValueOrDefault(f.TrainingId, string.Empty),
                f.OverallRating,
                f.TrainerRating,
                f.WouldRecommend,
                f.Comment,
                f.IsAnonymous,
                f.SubmittedAt));
        }

        return result;
    }

    /// <summary>Distinct non-cancelled sessions led, keyed by trainer (for "sessions count").</summary>
    public static async Task<Dictionary<string, int>> SessionsCountByTrainerAsync(
        TrainingDbContext db, CancellationToken ct)
    {
        var sessions = await db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.Status != SessionStatus.Cancelled)
            .Select(s => new { s.Id, s.TrainerEmployeeId, s.TrainerName, s.TrainerEmail })
            .ToListAsync(ct);

        return sessions
            .GroupBy(s => FeedbackAnalytics.TrainerKey(s.TrainerEmployeeId, s.TrainerEmail, s.TrainerName))
            .ToDictionary(g => g.Key, g => g.Select(s => s.Id).Distinct().Count());
    }
}
