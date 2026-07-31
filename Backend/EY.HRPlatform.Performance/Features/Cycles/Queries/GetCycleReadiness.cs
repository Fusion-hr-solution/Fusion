using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

/// <summary>
/// Live, computed launch readiness for a campaign Draft. Not a persisted state; reads never write.
/// </summary>
public sealed record GetCycleReadinessQuery(Guid CycleId) : IQuery<Result<CycleReadinessDto>>;

public sealed class GetCycleReadinessQueryHandler(
    PerformanceDbContext dbContext,
    ICampaignReadinessResolver readinessResolver)
    : IQueryHandler<GetCycleReadinessQuery, Result<CycleReadinessDto>>
{
    public async Task<Result<CycleReadinessDto>> Handle(GetCycleReadinessQuery request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.PopulationRules)
            .Include(c => c.ApproverOverrides)
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<CycleReadinessDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var readiness = await readinessResolver.ResolveAsync(cycle, cancellationToken);

        var participants = readiness.Participants
            .Select(p => new CampaignReadinessParticipantDto(
                p.EmployeeId,
                p.FullName,
                p.OrgUnitName,
                p.JobTitle,
                p.ApproverEmployeeId,
                p.ApproverName,
                p.IsApproverOverridden,
                p.ApproverOverrideReason,
                p.HasApprover))
            .ToList();

        return new CycleReadinessDto(
            readiness.CanLaunch,
            readiness.IsAllActiveBaseline,
            readiness.IncludedCount,
            participants,
            readiness.Exclusions,
            readiness.BlockingConditions,
            readiness.InformationalConditions);
    }
}
