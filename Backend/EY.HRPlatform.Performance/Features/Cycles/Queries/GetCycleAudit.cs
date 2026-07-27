using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCycleAuditQuery(Guid CycleId, int? Page = null, int? PageSize = null)
    : IQuery<Result<PagedResponse<CycleAuditEventDto>>>;

public sealed class GetCycleAuditQueryHandler(
    PerformanceDbContext dbContext) : IQueryHandler<GetCycleAuditQuery, Result<PagedResponse<CycleAuditEventDto>>>
{
    public async Task<Result<PagedResponse<CycleAuditEventDto>>> Handle(
        GetCycleAuditQuery request,
        CancellationToken cancellationToken)
    {
        var cycleExists = await dbContext.PerformanceCycles
            .AsNoTracking()
            .AnyAsync(c => c.Id == request.CycleId, cancellationToken);
        if (!cycleExists)
        {
            return Result.Failure<PagedResponse<CycleAuditEventDto>>(
                Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var page = HistoryPage.From(request.Page, request.PageSize);

        var query = dbContext.PerformanceCycleAuditEvents
            .AsNoTracking()
            .Where(a => a.CycleId == request.CycleId);

        var totalCount = await query.CountAsync(cancellationToken);

        // Id is the stable tiebreak: audit events written in the same instant must not reorder
        // between pages.
        var events = await query
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .ToListAsync(cancellationToken);

        return Result.Success(page.ToResponse(
            events.Select(CycleMapper.ToAuditDto).ToList(),
            totalCount));
    }
}
