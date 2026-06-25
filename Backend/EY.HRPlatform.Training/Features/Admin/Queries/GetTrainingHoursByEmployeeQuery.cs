using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>
/// US-8.2.1 — training-hours report, one row per employee: estimated e-learning hours, in-person
/// (attended-session wall-clock) hours, total, and completed-training count. The e-learning hours
/// model matches the learner "my hours" widget (see <see cref="ELearningHoursCalculator"/>).
/// </summary>
public record GetTrainingHoursByEmployeeQuery(AttendanceFilter Filter)
    : IQuery<Result<List<TrainingHoursRowDto>>>;

public class GetTrainingHoursByEmployeeQueryHandler
    : IQueryHandler<GetTrainingHoursByEmployeeQuery, Result<List<TrainingHoursRowDto>>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingHoursByEmployeeQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainingHoursRowDto>>> Handle(
        GetTrainingHoursByEmployeeQuery request, CancellationToken cancellationToken)
    {
        var filter = request.Filter;

        // In-person: attended sessions (wall-clock), optionally scoped by training + date range.
        var attendedQuery = _db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.Status == EnrollmentStatus.Attended && e.Session.Status != SessionStatus.Cancelled);
        if (filter.TrainingId.HasValue)
            attendedQuery = attendedQuery.Where(e => e.Session.Part.TrainingId == filter.TrainingId.Value);
        if (filter.From.HasValue)
            attendedQuery = attendedQuery.Where(e => e.Session.StartUtc >= filter.From.Value);
        if (filter.To.HasValue)
            attendedQuery = attendedQuery.Where(e => e.Session.StartUtc <= filter.To.Value);

        var attended = await attendedQuery
            .Select(e => new { e.EmployeeId, e.Session.StartUtc, e.Session.EndUtc })
            .ToListAsync(cancellationToken);

        var inPersonByEmployee = attended
            .GroupBy(a => a.EmployeeId)
            .ToDictionary(g => g.Key, g => g.Sum(a => (a.EndUtc - a.StartUtc).TotalHours));

        // E-learning: completed progress, optionally scoped by training + completion date range.
        var eHoursByTraining = await ELearningHoursCalculator.LoadAsync(_db, cancellationToken);

        var completedQuery = _db.TrainingProgress
            .AsNoTracking()
            .Where(p => p.Status == TrainingStatus.Completed);
        if (filter.TrainingId.HasValue)
            completedQuery = completedQuery.Where(p => p.TrainingId == filter.TrainingId.Value);
        if (filter.From.HasValue)
            completedQuery = completedQuery.Where(p => p.CompletedAt >= filter.From.Value);
        if (filter.To.HasValue)
            completedQuery = completedQuery.Where(p => p.CompletedAt <= filter.To.Value);

        var completed = await completedQuery
            .Select(p => new { p.EmployeeId, p.TrainingId, p.Training.TrainingType })
            .ToListAsync(cancellationToken);

        var completedByEmployee = completed
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    ELearningHours = g.Where(p => p.TrainingType == TrainingType.ELearning)
                                      .Sum(p => eHoursByTraining.GetValueOrDefault(p.TrainingId, 0)),
                    CompletedCount = g.Count(),
                });

        // Candidate employees = anyone with attended sessions or completions in scope.
        var employeeIds = inPersonByEmployee.Keys
            .Union(completedByEmployee.Keys)
            .Distinct()
            .ToList();
        if (employeeIds.Count == 0)
            return Result.Success(new List<TrainingHoursRowDto>());

        var profiles = await _db.EmployeeProfiles
            .AsNoTracking()
            .Where(ep => employeeIds.Contains(ep.EmployeeId))
            .Select(ep => new { ep.EmployeeId, ep.FullName, ep.GradeId, ep.ServiceLineId })
            .ToListAsync(cancellationToken);
        var profileLookup = profiles
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        var gradeNames = await _db.Grades.AsNoTracking()
            .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);
        var serviceLineNames = await _db.ServiceLines.AsNoTracking()
            .ToDictionaryAsync(s => s.Id, s => s.Name, cancellationToken);

        var rows = new List<TrainingHoursRowDto>(employeeIds.Count);
        foreach (var employeeId in employeeIds)
        {
            profileLookup.TryGetValue(employeeId, out var profile);

            // Apply grade / service-line filters against the employee's profile.
            if (filter.GradeId.HasValue && profile?.GradeId != filter.GradeId.Value) continue;
            if (filter.ServiceLineId.HasValue && profile?.ServiceLineId != filter.ServiceLineId.Value) continue;

            var inPerson = Math.Round(inPersonByEmployee.GetValueOrDefault(employeeId, 0), 2);
            completedByEmployee.TryGetValue(employeeId, out var elearning);
            var eHours = Math.Round(elearning?.ELearningHours ?? 0, 2);

            rows.Add(new TrainingHoursRowDto
            {
                EmployeeId = employeeId,
                EmployeeName = profile?.FullName,
                GradeName = profile?.GradeId is { } gid ? gradeNames.GetValueOrDefault(gid, "Unassigned") : "Unassigned",
                ServiceLineName = profile?.ServiceLineId is { } sid ? serviceLineNames.GetValueOrDefault(sid, "Unassigned") : "Unassigned",
                ELearningHours = eHours,
                InPersonHours = inPerson,
                TotalHours = Math.Round(eHours + inPerson, 2),
                TrainingsCompleted = elearning?.CompletedCount ?? 0,
            });
        }

        return Result.Success(rows.OrderBy(r => r.EmployeeName ?? "￿").ToList());
    }
}
