using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetCompletionByGradeQueryHandler
    : IQueryHandler<GetCompletionByGradeQuery, Result<List<CompletionByGradeDto>>>
{
    private readonly TrainingDbContext _db;

    public GetCompletionByGradeQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<CompletionByGradeDto>>> Handle(
        GetCompletionByGradeQuery request, CancellationToken cancellationToken)
    {
        var grades = await _db.Grades
            .OrderBy(g => g.Level)
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

        // Batch 3: all completed progress records for profiled employees
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

        // profiles grouped by grade
        var profilesByGrade = profiles
            .GroupBy(p => p.GradeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<CompletionByGradeDto>();

        foreach (var grade in grades)
        {
            var gradeProfiles = profilesByGrade.GetValueOrDefault(grade.Id, []);

            // Denominator = sum of curriculum size per employee based on their grade×SL
            // Numerator   = sum of completed curriculum trainings per employee
            int totalAssigned = 0;
            int totalCompleted = 0;

            foreach (var profile in gradeProfiles)
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

            result.Add(new CompletionByGradeDto
            {
                GradeId = grade.Id,
                GradeName = grade.Name,
                Level = grade.Level,
                EmployeeCount = gradeProfiles.Count,
                AvgCompletionRate = rate
            });
        }

        return Result.Success(result);
    }
}
