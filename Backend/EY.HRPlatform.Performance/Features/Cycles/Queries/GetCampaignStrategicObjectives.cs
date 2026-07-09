using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCampaignStrategicObjectivesQuery(Guid CycleId)
    : IQuery<Result<IReadOnlyList<CampaignStrategicObjectiveDto>>>;

public sealed class GetCampaignStrategicObjectivesQueryHandler(PerformanceDbContext dbContext)
    : IQueryHandler<GetCampaignStrategicObjectivesQuery, Result<IReadOnlyList<CampaignStrategicObjectiveDto>>>
{
    public async Task<Result<IReadOnlyList<CampaignStrategicObjectiveDto>>> Handle(
        GetCampaignStrategicObjectivesQuery request,
        CancellationToken cancellationToken)
    {
        var campaignExists = await dbContext.PerformanceCycles
            .AsNoTracking()
            .AnyAsync(cycle => cycle.Id == request.CycleId, cancellationToken);

        if (!campaignExists)
            return Result.Failure<IReadOnlyList<CampaignStrategicObjectiveDto>>(
                Error.NotFound("PerformanceCycle", request.CycleId));

        var objectives = await dbContext.CampaignStrategicObjectives
            .AsNoTracking()
            .Where(objective => objective.CycleId == request.CycleId)
            .OrderBy(objective => objective.CreatedAt)
            .ToListAsync(cancellationToken);

        return objectives.Select(CycleMapper.ToStrategicObjectiveDto).ToList();
    }
}
