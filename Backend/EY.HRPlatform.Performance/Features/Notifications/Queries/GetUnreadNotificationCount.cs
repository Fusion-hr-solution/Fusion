using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Notifications.Queries;

public sealed record GetUnreadNotificationCountQuery : IQuery<int>;

public sealed class GetUnreadNotificationCountQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetUnreadNotificationCountQuery, int>
{
    public async Task<int> Handle(GetUnreadNotificationCountQuery request, CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (employeeId is null)
        {
            return 0;
        }

        return await dbContext.PerformanceNotifications
            .AsNoTracking()
            .CountAsync(n => n.RecipientEmployeeId == employeeId.Value && n.ReadAt == null, cancellationToken);
    }
}
