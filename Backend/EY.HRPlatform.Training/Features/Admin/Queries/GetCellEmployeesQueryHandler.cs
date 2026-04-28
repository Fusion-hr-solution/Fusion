using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetCellEmployeesQueryHandler
    : IQueryHandler<GetCellEmployeesQuery, Result<List<CellEmployeeDto>>>
{
    private readonly TrainingDbContext _db;

    public GetCellEmployeesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<CellEmployeeDto>>> Handle(
        GetCellEmployeesQuery request, CancellationToken cancellationToken)
    {
        // 1 — profiles for this cell
        var profiles = await _db.EmployeeProfiles
            .Include(ep => ep.Grade)
            .Include(ep => ep.ServiceLine)
            .Where(ep => ep.GradeId == request.GradeId && ep.ServiceLineId == request.ServiceLineId)
            .ToListAsync(cancellationToken);

        if (profiles.Count == 0)
            return Result.Success(new List<CellEmployeeDto>());

        // 2 — curriculum mappings for this cell WITH training details
        var mappings = await _db.CurriculumMappings
            .Include(m => m.Training)
            .Where(m => m.GradeId == request.GradeId && m.ServiceLineId == request.ServiceLineId)
            .OrderBy(m => m.OrderIndex)
            .ToListAsync(cancellationToken);

        var curriculumTrainingIds = mappings.Select(m => m.TrainingId).ToList();
        var totalFormations = curriculumTrainingIds.Count;

        // 3 — all TrainingProgress rows for these employees × these trainings (single query)
        var employeeIds = profiles.Select(p => p.EmployeeId).ToList();

        var progressRows = curriculumTrainingIds.Count > 0 && employeeIds.Count > 0
            ? await _db.TrainingProgress
                .Where(tp =>
                    employeeIds.Contains(tp.EmployeeId)
                    && curriculumTrainingIds.Contains(tp.TrainingId))
                .Select(tp => new
                {
                    tp.EmployeeId,
                    tp.TrainingId,
                    tp.Status,
                    tp.ProgressPercentage,
                    LastActivity = tp.UpdatedAt
                })
                .ToListAsync(cancellationToken)
            : [];

        // employeeId → (trainingId → progress row)
        var progressLookup = progressRows
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(p => p.TrainingId));

        static string StatusLabel(TrainingStatus s) => s switch
        {
            TrainingStatus.InProgress => "in-progress",
            TrainingStatus.Completed  => "completed",
            TrainingStatus.Failed     => "failed",
            _                         => "not-started"
        };

        var result = profiles.Select(profile =>
        {
            var empProgress = progressLookup.GetValueOrDefault(profile.EmployeeId);

            var breakdown = mappings.Select(m =>
            {
                var row = empProgress?.GetValueOrDefault(m.TrainingId);
                return new CellEmployeeTrainingProgressDto
                {
                    TrainingId         = m.TrainingId,
                    TrainingTitle      = m.Training.Title,
                    TrainingType       = m.Training.TrainingType.ToString(),
                    Credits            = m.Training.Credits,
                    IsRequired         = m.IsRequired,
                    OrderIndex         = m.OrderIndex,
                    Status             = row is null ? "not-started" : StatusLabel(row.Status),
                    ProgressPercentage = row?.ProgressPercentage ?? 0,
                    LastActivityAt     = row?.LastActivity
                };
            }).ToList();

            int completed = breakdown.Count(b => b.Status == "completed");
            // Overall progress = avg of per-training progress percentages
            double overallPct = totalFormations > 0
                ? Math.Round(breakdown.Average(b => b.ProgressPercentage), 1)
                : 0;

            DateTime? lastActivity = empProgress?.Values
                .Select(p => p.LastActivity)
                .Where(d => d != default)
                .OrderByDescending(d => d)
                .FirstOrDefault();

            return new CellEmployeeDto
            {
                EmployeeId           = profile.EmployeeId,
                GradeName            = profile.Grade?.Name ?? "",
                ServiceLineName      = profile.ServiceLine?.Name ?? "",
                CompletedFormations  = completed,
                TotalFormations      = totalFormations,
                CompletionPercentage = overallPct,
                LastActivityAt       = lastActivity,
                TrainingBreakdown    = breakdown
            };
        }).ToList();

        return Result.Success(result);
    }
}
