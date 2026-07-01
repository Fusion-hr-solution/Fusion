using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCycleAuditQuery(Guid CycleId) : IQuery<Result<IReadOnlyList<CycleAuditEventDto>>>;

public sealed class GetCycleAuditQueryHandler(
    PerformanceDbContext dbContext) : IQueryHandler<GetCycleAuditQuery, Result<IReadOnlyList<CycleAuditEventDto>>>
{
    public async Task<Result<IReadOnlyList<CycleAuditEventDto>>> Handle(
        GetCycleAuditQuery request,
        CancellationToken cancellationToken)
    {
        var cycleExists = await dbContext.PerformanceCycles
            .AsNoTracking()
            .AnyAsync(c => c.Id == request.CycleId, cancellationToken);
        if (!cycleExists)
        {
            return Result.Failure<IReadOnlyList<CycleAuditEventDto>>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var events = await dbContext.PerformanceCycleAuditEvents
            .AsNoTracking()
            .Where(a => a.CycleId == request.CycleId)
            .OrderByDescending(a => a.OccurredAt)
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<CycleAuditEventDto>>(
            events.Select(CycleMapper.ToAuditDto).ToList());
    }
}
