using EY.HRPlatform.Performance.Features.Notifications.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Notifications.Queries;

public sealed record GetMyNotificationsQuery(
    bool UnreadOnly,
    int Page,
    int PageSize) : IQuery<NotificationFeedDto>;

/// <summary>
/// The notification list together with the caller's unread count.
/// </summary>
/// <remarks>
/// Folding the count into the list halves the bell's fixed polling cost: the frontend previously
/// issued two independent requests every 30 seconds per user, one for the list and one for the count.
/// The dedicated count endpoint is retained for callers that need only the badge, and both are
/// computed from the same predicate so they cannot disagree.
/// </remarks>
public sealed record NotificationFeedDto(
    PagedResponse<PerformanceNotificationDto> Notifications,
    int UnreadCount);

public sealed class GetMyNotificationsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyNotificationsQuery, NotificationFeedDto>
{
    private const int MaxPageSize = 100;

    public async Task<NotificationFeedDto> Handle(
        GetMyNotificationsQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var employeeId = currentUser.EmployeeId;
        if (employeeId is null)
        {
            return new NotificationFeedDto(
                new PagedResponse<PerformanceNotificationDto> { Page = page, PageSize = pageSize },
                UnreadCount: 0);
        }

        var mine = dbContext.PerformanceNotifications
            .AsNoTracking()
            .Where(n => n.RecipientEmployeeId == employeeId.Value);

        // Counted over the caller's whole set, not the current page or filter, so the badge is the
        // same number the dedicated count endpoint returns.
        var unreadCount = await mine.CountAsync(n => n.ReadAt == null, cancellationToken);

        var query = request.UnreadOnly ? mine.Where(n => n.ReadAt == null) : mine;

        var totalCount = await query.CountAsync(cancellationToken);
        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new NotificationFeedDto(
            new PagedResponse<PerformanceNotificationDto>
            {
                Items = notifications.Select(PerformanceNotificationMapper.ToDto).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            },
            unreadCount);
    }
}
