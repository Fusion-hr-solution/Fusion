using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCycleReadinessQuery(Guid CycleId) : IQuery<Result<CycleReadinessDto>>;

public sealed class GetCycleReadinessQueryHandler(PerformanceDbContext dbContext)
    : IQueryHandler<GetCycleReadinessQuery, Result<CycleReadinessDto>>
{
    public async Task<Result<CycleReadinessDto>> Handle(GetCycleReadinessQuery request, CancellationToken cancellationToken)
    {
        var cycleExists = await dbContext.PerformanceCycles
            .AsNoTracking()
            .AnyAsync(cycle => cycle.Id == request.CycleId, cancellationToken);
        if (!cycleExists)
        {
            return Result.Failure<CycleReadinessDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == request.CycleId)
            .OrderBy(participant => participant.FullName)
            .ToListAsync(cancellationToken);
        var unresolved = participants.Where(participant => !participant.HasResolvedPlanningApprover).ToList();

        return new CycleReadinessDto(
            participants.Count,
            participants.Count - unresolved.Count,
            unresolved.Count,
            unresolved.Select(CycleMapper.ToParticipantDto).ToList());
    }
}
