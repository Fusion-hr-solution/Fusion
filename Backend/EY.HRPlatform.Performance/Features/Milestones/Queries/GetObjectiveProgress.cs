using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Milestones.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Milestones.Queries;

public sealed record GetObjectiveProgressQuery(Guid ObjectiveId) : IQuery<Result<ObjectiveProgressDto>>;

public sealed class GetObjectiveProgressQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : IQueryHandler<GetObjectiveProgressQuery, Result<ObjectiveProgressDto>>
{
    public async Task<Result<ObjectiveProgressDto>> Handle(
        GetObjectiveProgressQuery request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<ObjectiveProgressDto>(
                Error.Forbidden("Progress.EmployeeContextRequired", "An employee context is required to view progress."));

        var objective = await dbContext.PerformanceObjectives
            .AsNoTracking()
            .SingleOrDefaultAsync(o => o.Id == request.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<ObjectiveProgressDto>(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        var principal = httpContextAccessor.HttpContext?.User;
        var canCorrectProgress = principal is not null && accessPolicy.CanCorrectObjectiveProgress(principal);
        if (objective.OwnerEmployeeId != currentUser.EmployeeId.Value && !canCorrectProgress)
        {
            return Result.Failure<ObjectiveProgressDto>(
                Error.Forbidden("Progress.NotVisible", "Only the objective owner or an authorized manager can view progress."));
        }

        var milestones = await dbContext.PerformanceObjectiveMilestones
            .AsNoTracking()
            .Where(m => m.ObjectiveId == objective.Id)
            .OrderBy(m => m.DueDate)
            .Select(m => new MilestoneDetailDto(
                m.Id,
                m.Title,
                m.DueDate,
                m.IsCompleted,
                m.CompletedAt))
            .ToListAsync(cancellationToken);

        var completedCount = milestones.Count(m => m.IsCompleted);
        var totalCount = milestones.Count;

        decimal effectivePercent;
        if (objective.ProgressMode == ObjectiveProgressMode.MilestoneRollup)
        {
            effectivePercent = totalCount == 0
                ? 0m
                : (decimal)completedCount / totalCount * 100m;
        }
        else
        {
            effectivePercent = objective.ManualProgressPercent ?? 0m;
        }

        return new ObjectiveProgressDto(
            effectivePercent,
            objective.ProgressMode.ToString(),
            completedCount,
            totalCount,
            milestones);
    }
}
