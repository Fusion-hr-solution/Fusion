using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetProgrammeMatrixQueryHandler
    : IQueryHandler<GetProgrammeMatrixQuery, Result<ProgrammeMatrixDto>>
{
    private readonly TrainingDbContext _db;

    public GetProgrammeMatrixQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<ProgrammeMatrixDto>> Handle(
        GetProgrammeMatrixQuery request, CancellationToken cancellationToken)
    {
        var grades = await _db.Grades
            .OrderBy(g => g.Level)
            .Select(g => new GradeDto
            {
                Id = g.Id,
                Name = g.Name,
                Level = g.Level,
                Description = g.Description,
                Icon = g.Icon
            })
            .ToListAsync(cancellationToken);

        var serviceLines = await _db.ServiceLines
            .OrderBy(s => s.Name)
            .Select(s => new ServiceLineDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                Description = s.Description,
                Color = s.Color,
                IsSharedAcrossAllServiceLines = s.IsSharedAcrossAllServiceLines
            })
            .ToListAsync(cancellationToken);

        // Get employee profiles grouped by grade + service line
        var profileGroups = await _db.EmployeeProfiles
            .Where(ep => ep.GradeId != null && ep.ServiceLineId != null)
            .GroupBy(ep => new { ep.GradeId, ep.ServiceLineId })
            .Select(g => new
            {
                GradeId = g.Key.GradeId!.Value,
                ServiceLineId = g.Key.ServiceLineId!.Value,
                EmployeeIds = g.Select(ep => ep.EmployeeId).ToList()
            })
            .ToListAsync(cancellationToken);

        // Get curriculum mapping counts per cell
        var mappingCounts = await _db.CurriculumMappings
            .GroupBy(m => new { m.GradeId, m.ServiceLineId })
            .Select(g => new
            {
                g.Key.GradeId,
                g.Key.ServiceLineId,
                Count = g.Count()
            })
            .ToListAsync(cancellationToken);

        var mappingLookup = mappingCounts.ToDictionary(
            m => (m.GradeId, m.ServiceLineId), m => m.Count);

        // For each cell, compute avg completion rate from TrainingProgress
        var cells = new List<ProgrammeMatrixCellDto>();

        foreach (var group in profileGroups)
        {
            var totalFormations = mappingLookup.GetValueOrDefault(
                (group.GradeId, group.ServiceLineId), 0);

            // Get training IDs for this cell's curriculum
            var curriculumTrainingIds = await _db.CurriculumMappings
                .Where(m => m.GradeId == group.GradeId && m.ServiceLineId == group.ServiceLineId)
                .Select(m => m.TrainingId)
                .ToListAsync(cancellationToken);

            if (curriculumTrainingIds.Count == 0)
            {
                cells.Add(new ProgrammeMatrixCellDto
                {
                    GradeId = group.GradeId,
                    ServiceLineId = group.ServiceLineId,
                    EmployeeCount = group.EmployeeIds.Count,
                    AvgCompletionRate = 0,
                    TotalFormations = 0,
                    CompletedFormations = 0
                });
                continue;
            }

            // Count completed trainings for employees in this cell
            var progressStats = await _db.TrainingProgress
                .Where(tp => group.EmployeeIds.Contains(tp.EmployeeId)
                    && curriculumTrainingIds.Contains(tp.TrainingId))
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Completed = g.Count(tp => tp.Status == TrainingStatus.Completed),
                    Total = g.Count()
                })
                .FirstOrDefaultAsync(cancellationToken);

            var expectedTotal = group.EmployeeIds.Count * curriculumTrainingIds.Count;
            var completedCount = progressStats?.Completed ?? 0;
            var avgRate = expectedTotal > 0
                ? Math.Round((double)completedCount / expectedTotal * 100, 1)
                : 0;

            cells.Add(new ProgrammeMatrixCellDto
            {
                GradeId = group.GradeId,
                ServiceLineId = group.ServiceLineId,
                EmployeeCount = group.EmployeeIds.Count,
                AvgCompletionRate = avgRate,
                TotalFormations = totalFormations,
                CompletedFormations = completedCount
            });
        }

        return Result.Success(new ProgrammeMatrixDto
        {
            Grades = grades,
            ServiceLines = serviceLines,
            Cells = cells
        });
    }
}
