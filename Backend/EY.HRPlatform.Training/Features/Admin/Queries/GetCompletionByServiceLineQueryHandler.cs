using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetCompletionByServiceLineQueryHandler
    : IQueryHandler<GetCompletionByServiceLineQuery, Result<List<CompletionByServiceLineDto>>>
{
    private readonly TrainingDbContext _db;

    public GetCompletionByServiceLineQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<CompletionByServiceLineDto>>> Handle(
        GetCompletionByServiceLineQuery request, CancellationToken cancellationToken)
    {
        var serviceLines = await _db.ServiceLines
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);

        // Batch 1: all profiles with grade + service line
        var profiles = await _db.EmployeeProfiles
            .Where(ep => ep.GradeId != null && ep.ServiceLineId != null)
            .Select(ep => new
            {
                ep.EmployeeId,
                GradeId = ep.GradeId!.Value,
                ServiceLineId = ep.ServiceLineId!.Value
            })
            .ToListAsync(cancellationToken);

        // Batch 2: all curriculum mappings
        var mappings = await _db.CurriculumMappings
            .Select(m => new { m.GradeId, m.ServiceLineId, m.TrainingId })
            .ToListAsync(cancellationToken);

        // Build curriculum lookup: (gradeId, serviceLineId) → set of trainingIds
        var curriculumLookup = mappings
            .GroupBy(m => (m.GradeId, m.ServiceLineId))
            .ToDictionary(g => g.Key, g => g.Select(m => m.TrainingId).ToHashSet());

        // Batch 3: all completed progress records
        var profiledEmployeeIds = profiles.Select(p => p.EmployeeId).Distinct().ToList();
        var allCurriculumTrainingIds = mappings.Select(m => m.TrainingId).Distinct().ToList();

        var completedProgressRaw = profiledEmployeeIds.Count > 0 && allCurriculumTrainingIds.Count > 0
            ? await _db.TrainingProgress
                .Where(tp =>
                    profiledEmployeeIds.Contains(tp.EmployeeId)
                    && allCurriculumTrainingIds.Contains(tp.TrainingId)
                    && tp.Status == TrainingStatus.Completed)
                .Select(tp => new { tp.EmployeeId, tp.TrainingId })
                .ToListAsync(cancellationToken)
            : [];

        // employeeId → set of completed trainingIds
        var completedByEmployee = completedProgressRaw
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.TrainingId).ToHashSet());

        // profiles grouped by service line
        var profilesByServiceLine = profiles
            .GroupBy(p => p.ServiceLineId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<CompletionByServiceLineDto>();

        foreach (var sl in serviceLines)
        {
            var slProfiles = profilesByServiceLine.GetValueOrDefault(sl.Id, []);

            // Denominator = sum of curriculum size per employee based on their grade×SL
            // Numerator   = sum of completed curriculum trainings per employee
            int totalAssigned = 0;
            int totalCompleted = 0;

            foreach (var profile in slProfiles)
            {
                var key = (profile.GradeId, profile.ServiceLineId);
                if (!curriculumLookup.TryGetValue(key, out var curriculum))
                    continue;

                totalAssigned += curriculum.Count;

                if (completedByEmployee.TryGetValue(profile.EmployeeId, out var completedSet))
                    totalCompleted += completedSet.Intersect(curriculum).Count();
            }

            var rate = totalAssigned > 0
                ? Math.Round((double)totalCompleted / totalAssigned * 100, 1)
                : 0;

            result.Add(new CompletionByServiceLineDto
            {
                ServiceLineId = sl.Id,
                ServiceLineName = sl.Name,
                Color = sl.Color,
                EmployeeCount = slProfiles.Count,
                AvgCompletionRate = rate
            });
        }

        return Result.Success(result);
    }
}
