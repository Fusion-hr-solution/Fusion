using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCampaignResponsibilitiesQuery(Guid CycleId, string State)
    : IQuery<Result<CampaignResponsibilitiesDto>>;

/// <summary>
/// The sole read model for final objective-approval responsibility coverage. Readiness and
/// launch validation must consume this same projection rather than participant projections.
/// </summary>
public sealed class GetCampaignResponsibilitiesQueryHandler(PerformanceDbContext dbContext)
    : IQueryHandler<GetCampaignResponsibilitiesQuery, Result<CampaignResponsibilitiesDto>>
{
    public async Task<Result<CampaignResponsibilitiesDto>> Handle(
        GetCampaignResponsibilitiesQuery request,
        CancellationToken cancellationToken)
        => await CampaignResponsibilityReadModel.LoadAsync(dbContext, request.CycleId, request.State, cancellationToken);
}
