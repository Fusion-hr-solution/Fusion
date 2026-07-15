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
    int PageSize) : IQuery<PagedResponse<PerformanceNotificationDto>>;

public sealed class GetMyNotificationsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyNotificationsQuery, PagedResponse<PerformanceNotificationDto>>
{
    private const int MaxPageSize = 100;

    public async Task<PagedResponse<PerformanceNotificationDto>> Handle(
        GetMyNotificationsQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var employeeId = currentUser.EmployeeId;
        if (employeeId is null)
        {
            return new PagedResponse<PerformanceNotificationDto> { Page = page, PageSize = pageSize };
        }

        var query = dbContext.PerformanceNotifications
            .AsNoTracking()
            .Where(n => n.RecipientEmployeeId == employeeId.Value);

        if (request.UnreadOnly)
        {
            query = query.Where(n => n.ReadAt == null);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResponse<PerformanceNotificationDto>
        {
            Items = notifications.Select(PerformanceNotificationMapper.ToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }
}
