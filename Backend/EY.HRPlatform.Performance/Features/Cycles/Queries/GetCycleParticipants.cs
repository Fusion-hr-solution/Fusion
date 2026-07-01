using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCycleParticipantsQuery(
    Guid CycleId,
    string? Search,
    int Page,
    int PageSize) : IQuery<Result<PagedResponse<CycleParticipantDto>>>;

public sealed class GetCycleParticipantsQueryHandler(
    PerformanceDbContext dbContext) : IQueryHandler<GetCycleParticipantsQuery, Result<PagedResponse<CycleParticipantDto>>>
{
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResponse<CycleParticipantDto>>> Handle(
        GetCycleParticipantsQuery request,
        CancellationToken cancellationToken)
    {
        var cycleExists = await dbContext.PerformanceCycles
            .AsNoTracking()
            .AnyAsync(c => c.Id == request.CycleId, cancellationToken);
        if (!cycleExists)
        {
            return Result.Failure<PagedResponse<CycleParticipantDto>>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var query = dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(p => p.CycleId == request.CycleId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLowerInvariant();
            query = query.Where(p =>
                p.FullName.ToLower().Contains(term) ||
                (p.Email != null && p.Email.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var participants = await query
            .OrderBy(p => p.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var response = new PagedResponse<CycleParticipantDto>
        {
            Items = participants.Select(CycleMapper.ToParticipantDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };

        return response;
    }
}
