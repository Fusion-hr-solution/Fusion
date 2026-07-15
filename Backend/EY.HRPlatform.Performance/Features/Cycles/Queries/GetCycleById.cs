using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCycleByIdQuery(Guid CycleId) : IQuery<Result<PerformanceCycleDetailDto>>;

public sealed class GetCycleByIdQueryHandler(
    PerformanceDbContext dbContext,
    IOptions<ReminderOptions> reminderOptions) : IQueryHandler<GetCycleByIdQuery, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        GetCycleByIdQuery request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.PopulationRules)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var participantCount = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .CountAsync(p => p.CycleId == cycle.Id, cancellationToken);

        return CycleMapper.ToDetail(cycle, participantCount, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}
