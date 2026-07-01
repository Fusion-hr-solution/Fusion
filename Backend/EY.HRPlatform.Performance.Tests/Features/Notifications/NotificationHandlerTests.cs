using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Notifications.Commands;
using EY.HRPlatform.Performance.Features.Notifications.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Notifications;

public class NotificationHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private static PerformanceNotification Seed(Guid recipientEmployeeId)
        => PerformanceNotification.Create(
            TenantId, recipientEmployeeId, PerformanceNotificationType.CyclePublished, "t", "m");

    [Fact]
    public async Task GetMine_ReturnsOnlyOwnNotifications()
    {
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(TenantId, out _);
        db.PerformanceNotifications.AddRange(Seed(me), Seed(me), Seed(other));
        await db.SaveChangesAsync();

        var handler = new GetMyNotificationsQueryHandler(db, new StubCurrentUserContext { EmployeeId = me });
        var result = await handler.Handle(new GetMyNotificationsQuery(false, 1, 20), CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public async Task MarkRead_ForOtherRecipient_IsNotFound()
    {
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(TenantId, out _);
        var otherNotification = Seed(other);
        db.PerformanceNotifications.Add(otherNotification);
        await db.SaveChangesAsync();

        var handler = new MarkNotificationReadCommandHandler(db, new StubCurrentUserContext { EmployeeId = me });
        var result = await handler.Handle(new MarkNotificationReadCommand(otherNotification.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        var stored = await db.PerformanceNotifications.SingleAsync(n => n.Id == otherNotification.Id);
        Assert.False(stored.IsRead);
    }

    [Fact]
    public async Task MarkAllRead_MarksOnlyOwnUnread()
    {
        var me = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(TenantId, out _);
        db.PerformanceNotifications.AddRange(Seed(me), Seed(me), Seed(Guid.NewGuid()));
        await db.SaveChangesAsync();

        var currentUser = new StubCurrentUserContext { EmployeeId = me };
        await new MarkAllNotificationsReadCommandHandler(db, currentUser)
            .Handle(new MarkAllNotificationsReadCommand(), CancellationToken.None);

        var unreadForMe = await new GetUnreadNotificationCountQueryHandler(db, currentUser)
            .Handle(new GetUnreadNotificationCountQuery(), CancellationToken.None);
        Assert.Equal(0, unreadForMe);
    }
}
