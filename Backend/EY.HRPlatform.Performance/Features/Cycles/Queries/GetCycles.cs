using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

public sealed record GetCyclesQuery(
    string? Search,
    string? Status,
    string? Type,
    int Page,
    int PageSize) : IQuery<PagedResponse<PerformanceCycleSummaryDto>>;

public sealed class GetCyclesQueryHandler(
    PerformanceDbContext dbContext,
    IOptions<ReminderOptions> reminderOptions) : IQueryHandler<GetCyclesQuery, PagedResponse<PerformanceCycleSummaryDto>>
{
    private const int MaxPageSize = 100;

    public async Task<PagedResponse<PerformanceCycleSummaryDto>> Handle(
        GetCyclesQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var query = dbContext.PerformanceCycles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLowerInvariant();
            query = query.Where(c => c.Name.ToLower().Contains(term));
        }

        if (Enum.TryParse<PerformanceCycleStatus>(request.Status, ignoreCase: true, out var status))
        {
            query = query.Where(c => c.Status == status);
        }

        if (Enum.TryParse<PerformanceCycleType>(request.Type, ignoreCase: true, out var type))
        {
            query = query.Where(c => c.Type == type);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var cycles = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var cycleIds = cycles.Select(c => c.Id).ToList();
        var participantCounts = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(p => cycleIds.Contains(p.CycleId))
            .GroupBy(p => p.CycleId)
            .Select(group => new { CycleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.CycleId, group => group.Count, cancellationToken);

        var now = DateTime.UtcNow;
        var window = reminderOptions.Value.DueSoonWindowDays;
        var items = cycles
            .Select(c => CycleMapper.ToSummary(c, participantCounts.GetValueOrDefault(c.Id), window, now))
            .ToList();

        return new PagedResponse<PerformanceCycleSummaryDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }
}
