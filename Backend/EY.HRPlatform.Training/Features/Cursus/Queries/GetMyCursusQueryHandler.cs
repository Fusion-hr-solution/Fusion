using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Cursus.Queries;

public class GetMyCursusQueryHandler : IQueryHandler<GetMyCursusQuery, Result<MyCursusDto>>
{
    private readonly TrainingDbContext _db;

    public GetMyCursusQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<MyCursusDto>> Handle(GetMyCursusQuery request, CancellationToken cancellationToken)
    {
        var profile = await _db.EmployeeProfiles
            .FirstOrDefaultAsync(p => p.EmployeeId == request.EmployeeId, cancellationToken);

        if (profile is null)
            return Result.Failure<MyCursusDto>(Error.NotFound("EmployeeProfile", request.EmployeeId));

        if (profile.GradeId is null || profile.ServiceLineId is null)
            return Result.Failure<MyCursusDto>(Error.Validation("EmployeeProfile.Incomplete",
                "Your profile does not have a grade and service line assigned yet."));

        // Get IDs of shared service lines
        var sharedServiceLineIds = await _db.ServiceLines
            .Where(s => s.IsSharedAcrossAllServiceLines)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        // Fetch mappings: employee's (grade, SL) + any shared SLs
        var mappings = await _db.CurriculumMappings
            .Include(m => m.Training)
            .Include(m => m.ServiceLine)
            .Where(m => m.GradeId == profile.GradeId
                && (m.ServiceLineId == profile.ServiceLineId
                    || sharedServiceLineIds.Contains(m.ServiceLineId)))
            .OrderByDescending(m => m.IsRequired)
            .ThenBy(m => m.OrderIndex)
            .ThenBy(m => m.Training.Title)
            .ToListAsync(cancellationToken);

        // Load the employee's training progress for matched trainings
        var trainingIds = mappings.Select(m => m.TrainingId).Distinct().ToList();
        var progressRecords = await _db.TrainingProgress
            .Where(p => p.EmployeeId == request.EmployeeId && trainingIds.Contains(p.TrainingId))
            .ToDictionaryAsync(p => p.TrainingId, cancellationToken);

        var items = mappings.Select(m =>
        {
            progressRecords.TryGetValue(m.TrainingId, out var progress);
            var status = progress?.Status switch
            {
                TrainingStatus.Completed => "completed",
                TrainingStatus.InProgress => "in-progress",
                TrainingStatus.Failed => "failed",
                _ => "not-started"
            };

            return new MyCursusItemDto
            {
                MappingId = m.Id,
                TrainingId = m.TrainingId,
                TrainingTitle = m.Training.Title,
                TrainingDescription = m.Training.Description,
                TrainingType = m.Training.TrainingType.ToString(),
                Credits = m.Training.Credits,
                Duration = m.Training.Duration,
                BadgeLevel = m.Training.BadgeLevel.ToString(),
                ScheduledDate = m.Training.ScheduledDate,
                IsRequired = m.IsRequired,
                OrderIndex = m.OrderIndex,
                Status = status,
                ProgressPercentage = progress?.ProgressPercentage ?? 0,
                LastActivityAt = progress?.UpdatedAt,
                IsFromSharedServiceLine = m.ServiceLineId != profile.ServiceLineId
            };
        }).ToList();

        // Compute summary
        var completedItems = items.Where(i => i.Status == "completed").ToList();
        var summary = new MyCursusSummaryDto
        {
            TotalCount = items.Count,
            CompletedCount = completedItems.Count,
            InProgressCount = items.Count(i => i.Status == "in-progress"),
            NotStartedCount = items.Count(i => i.Status == "not-started"),
            RequiredCreditsTotal = items.Where(i => i.IsRequired).Sum(i => i.Credits),
            RequiredCreditsEarned = completedItems.Where(i => i.IsRequired).Sum(i => i.Credits),
            EstimatedRemainingMinutes = items
                .Where(i => i.Status != "completed" && i.Duration != null)
                .Sum(i => int.TryParse(i.Duration, out var mins) ? mins : 0)
        };

        return Result.Success(new MyCursusDto
        {
            Summary = summary,
            Items = items
        });
    }
}
