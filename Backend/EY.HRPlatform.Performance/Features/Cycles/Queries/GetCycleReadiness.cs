using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCycleReadinessQuery(Guid CycleId) : IQuery<Result<CycleReadinessDto>>;

public sealed class GetCycleReadinessQueryHandler(
    PerformanceDbContext dbContext,
    ICoreWorkforceClient workforceClient)
    : IQueryHandler<GetCycleReadinessQuery, Result<CycleReadinessDto>>
{
    public async Task<Result<CycleReadinessDto>> Handle(GetCycleReadinessQuery request, CancellationToken cancellationToken)
    {
        var responsibilities = await CampaignResponsibilityReadModel.LoadAsync(
            dbContext, request.CycleId, "all", cancellationToken);
        if (responsibilities.IsFailure)
            return Result.Failure<CycleReadinessDto>(responsibilities.Error);

        // Re-resolve the curated people against current Core truth so the operator can review the
        // workforce delta before launch. Only confirmed responsibilities carry an assignee to check.
        var delta = await CampaignWorkforceDeltaResolver.ComputeAsync(
            responsibilities.Value.Items.Where(x => x.CurrentResponsibility is not null).ToList(),
            workforceClient,
            cancellationToken);

        return new CycleReadinessDto(
            responsibilities.Value.ParticipantCount,
            responsibilities.Value.ConfirmedObjectiveResponsibilityCount,
            responsibilities.Value.MissingObjectiveResponsibilityCount,
            responsibilities.Value.Items.Where(x => x.CurrentResponsibility is null).ToList(),
            delta);
    }
}
