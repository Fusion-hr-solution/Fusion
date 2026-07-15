using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Notifications.Commands;

public sealed record MarkNotificationReadCommand(Guid NotificationId) : ICommand<Result>;

public sealed record MarkAllNotificationsReadCommand : ICommand<Result>;

public sealed class MarkNotificationReadCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<MarkNotificationReadCommand, Result>
{
    public async Task<Result> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (employeeId is null)
        {
            return Result.Failure(Error.NotFound("PerformanceNotification", request.NotificationId));
        }

        var notification = await dbContext.PerformanceNotifications
            .FirstOrDefaultAsync(
                n => n.Id == request.NotificationId && n.RecipientEmployeeId == employeeId.Value,
                cancellationToken);
        if (notification is null)
        {
            return Result.Failure(Error.NotFound("PerformanceNotification", request.NotificationId));
        }

        notification.MarkRead();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public sealed class MarkAllNotificationsReadCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<MarkAllNotificationsReadCommand, Result>
{
    public async Task<Result> Handle(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (employeeId is null)
        {
            return Result.Success();
        }

        var unread = await dbContext.PerformanceNotifications
            .Where(n => n.RecipientEmployeeId == employeeId.Value && n.ReadAt == null)
            .ToListAsync(cancellationToken);

        foreach (var notification in unread)
        {
            notification.MarkRead();
        }

        if (unread.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Result.Success();
    }
}
