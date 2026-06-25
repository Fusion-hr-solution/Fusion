using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>Period / grade / service-line scope for the in-person vs e-learning comparison.</summary>
public record CompletionByFormatFilter(
    Guid? GradeId = null,
    Guid? ServiceLineId = null,
    DateTime? From = null,
    DateTime? To = null);

/// <summary>
/// US-8.2.2 §2 — in-person vs e-learning comparison. Per format: active training count, hours
/// delivered, participants, curriculum completion rate, and average feedback. Completion rate is
/// curriculum-based (matches the programme dashboard); participants/hours reflect actual activity.
/// </summary>
public record GetCompletionByFormatQuery(CompletionByFormatFilter Filter)
    : IQuery<Result<FormatComparisonDto>>;

public class GetCompletionByFormatQueryHandler
    : IQueryHandler<GetCompletionByFormatQuery, Result<FormatComparisonDto>>
{
    private readonly TrainingDbContext _db;

    public GetCompletionByFormatQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<FormatComparisonDto>> Handle(
        GetCompletionByFormatQuery request, CancellationToken cancellationToken)
    {
        var f = request.Filter;

        // Active trainings → type lookup + per-format training count.
        var trainings = await _db.Set<Domain.Entities.TrainingCourse>()
            .AsNoTracking()
            .Where(t => !t.IsDeleted)
            .Select(t => new { t.Id, t.TrainingType })
            .ToListAsync(cancellationToken);
        var typeById = trainings.ToDictionary(t => t.Id, t => t.TrainingType);

        // Eligible employees (grade / service-line scope). Null ⇒ no restriction.
        var allProfiles = await _db.EmployeeProfiles
            .AsNoTracking()
            .Select(ep => new { ep.EmployeeId, ep.GradeId, ep.ServiceLineId })
            .ToListAsync(cancellationToken);

        HashSet<Guid>? eligible = null;
        if (f.GradeId.HasValue || f.ServiceLineId.HasValue)
        {
            eligible = allProfiles
                .Where(p => (!f.GradeId.HasValue || p.GradeId == f.GradeId.Value)
                            && (!f.ServiceLineId.HasValue || p.ServiceLineId == f.ServiceLineId.Value))
                .Select(p => p.EmployeeId)
                .ToHashSet();
        }
        bool IsEligible(Guid employeeId) => eligible is null || eligible.Contains(employeeId);

        // Completions (date-scoped), used for participants + e-learning hours + curriculum rate.
        var completedQuery = _db.TrainingProgress.AsNoTracking()
            .Where(p => p.Status == TrainingStatus.Completed);
        if (f.From.HasValue) completedQuery = completedQuery.Where(p => p.CompletedAt >= f.From.Value);
        if (f.To.HasValue) completedQuery = completedQuery.Where(p => p.CompletedAt <= f.To.Value);
        var completed = await completedQuery
            .Select(p => new { p.EmployeeId, p.TrainingId, p.Training.TrainingType })
            .ToListAsync(cancellationToken);

        var eHoursByTraining = await ELearningHoursCalculator.LoadAsync(_db, cancellationToken);

        var eligibleCompleted = completed.Where(c => IsEligible(c.EmployeeId)).ToList();
        var participantsELearning = eligibleCompleted
            .Where(c => c.TrainingType == TrainingType.ELearning)
            .Select(c => c.EmployeeId).Distinct().Count();
        var eLearningHoursDelivered = eligibleCompleted
            .Where(c => c.TrainingType == TrainingType.ELearning)
            .Sum(c => eHoursByTraining.GetValueOrDefault(c.TrainingId, 0));

        // On-site: attended sessions (date-scoped) → participants + hours delivered (wall-clock).
        var attendedQuery = _db.SessionEnrollments.AsNoTracking()
            .Where(e => e.Status == EnrollmentStatus.Attended && e.Session.Status != SessionStatus.Cancelled);
        if (f.From.HasValue) attendedQuery = attendedQuery.Where(e => e.Session.StartUtc >= f.From.Value);
        if (f.To.HasValue) attendedQuery = attendedQuery.Where(e => e.Session.StartUtc <= f.To.Value);
        var attended = await attendedQuery
            .Select(e => new { e.EmployeeId, e.Session.StartUtc, e.Session.EndUtc })
            .ToListAsync(cancellationToken);
        var eligibleAttended = attended.Where(a => IsEligible(a.EmployeeId)).ToList();
        var participantsOnSite = eligibleAttended.Select(a => a.EmployeeId).Distinct().Count();
        var onSiteHoursDelivered = eligibleAttended.Sum(a => (a.EndUtc - a.StartUtc).TotalHours);

        // Curriculum completion rate per format (matches the programme dashboard, split by type).
        var profilesForRate = allProfiles
            .Where(p => p.GradeId != null && p.ServiceLineId != null)
            .Where(p => (!f.GradeId.HasValue || p.GradeId == f.GradeId.Value)
                        && (!f.ServiceLineId.HasValue || p.ServiceLineId == f.ServiceLineId.Value))
            .ToList();
        var mappings = await _db.CurriculumMappings.AsNoTracking()
            .Select(m => new { m.GradeId, m.ServiceLineId, m.TrainingId })
            .ToListAsync(cancellationToken);
        var curriculumLookup = mappings
            .GroupBy(m => (m.GradeId, m.ServiceLineId))
            .ToDictionary(g => g.Key, g => g.Select(m => m.TrainingId).ToHashSet());
        var completedByEmployee = completed
            .GroupBy(c => c.EmployeeId)
            .ToDictionary(g => g.Key, g => g.Select(c => c.TrainingId).ToHashSet());

        int assignedE = 0, assignedO = 0, completedE = 0, completedO = 0;
        foreach (var profile in profilesForRate)
        {
            if (!curriculumLookup.TryGetValue((profile.GradeId!.Value, profile.ServiceLineId!.Value), out var curriculum))
                continue;
            completedByEmployee.TryGetValue(profile.EmployeeId, out var done);

            foreach (var trainingId in curriculum)
            {
                if (!typeById.TryGetValue(trainingId, out var type)) continue;
                var isDone = done is not null && done.Contains(trainingId);
                if (type == TrainingType.ELearning) { assignedE++; if (isDone) completedE++; }
                else { assignedO++; if (isDone) completedO++; }
            }
        }

        // Average feedback per format (date-scoped on submission; not grade-scoped, as in the overview).
        var feedbackQuery = _db.TrainingFeedbacks.AsNoTracking();
        if (f.From.HasValue) feedbackQuery = feedbackQuery.Where(x => x.SubmittedAt >= f.From.Value);
        if (f.To.HasValue) feedbackQuery = feedbackQuery.Where(x => x.SubmittedAt <= f.To.Value);
        var feedback = await feedbackQuery
            .Select(x => new { x.OverallRating, x.Training.TrainingType })
            .ToListAsync(cancellationToken);
        double? AvgFeedback(TrainingType type)
        {
            var ratings = feedback.Where(x => x.TrainingType == type).Select(x => x.OverallRating).ToList();
            return ratings.Count > 0 ? Math.Round(ratings.Average(), 2) : null;
        }

        var dto = new FormatComparisonDto
        {
            ELearning = new FormatMetricsDto
            {
                Format = nameof(TrainingType.ELearning),
                TrainingCount = trainings.Count(t => t.TrainingType == TrainingType.ELearning),
                HoursDelivered = Math.Round(eLearningHoursDelivered, 2),
                Participants = participantsELearning,
                CompletionRate = AttendanceFactLoader.Rate(completedE, assignedE),
                AvgFeedback = AvgFeedback(TrainingType.ELearning),
            },
            OnSite = new FormatMetricsDto
            {
                Format = nameof(TrainingType.OnSite),
                TrainingCount = trainings.Count(t => t.TrainingType == TrainingType.OnSite),
                HoursDelivered = Math.Round(onSiteHoursDelivered, 2),
                Participants = participantsOnSite,
                CompletionRate = AttendanceFactLoader.Rate(completedO, assignedO),
                AvgFeedback = AvgFeedback(TrainingType.OnSite),
            },
        };

        return Result.Success(dto);
    }
}
