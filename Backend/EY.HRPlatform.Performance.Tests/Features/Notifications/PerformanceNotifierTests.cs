using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Notifications.Commands;
using EY.HRPlatform.Performance.Features.Notifications.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Notifications;

public class PerformanceNotifierTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task Notify_WithDedupKey_IsIdempotent()
    {
        var dbName = $"notify-dedup-{Guid.NewGuid()}";
        var recipient = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(TenantId, out var tenant, dbName);
        var notifier = new PerformanceNotifier(db, tenant);

        await notifier.NotifyAsync(recipient, PerformanceNotificationType.PlanApproved, "t", "m",
            subjectType: "EmployeeObjectivePlan", subjectId: Guid.NewGuid(),
            navigationRoute: "/performance/objectives/x", dedupKey: "same-key");
        await notifier.NotifyAsync(recipient, PerformanceNotificationType.PlanApproved, "t", "m",
            dedupKey: "same-key");

        Assert.Equal(1, await db.PerformanceNotifications.CountAsync());
    }

    [Fact]
    public async Task Notify_StoresSubjectAndRoute()
    {
        var dbName = $"notify-subject-{Guid.NewGuid()}";
        var recipient = Guid.NewGuid();
        var subjectId = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(TenantId, out var tenant, dbName);
        await new PerformanceNotifier(db, tenant).NotifyAsync(
            recipient, PerformanceNotificationType.PlanSubmitted, "t", "m",
            subjectType: "EmployeeObjectivePlan", subjectId: subjectId,
            navigationRoute: "/performance/plan-approvals/c/p");

        var stored = await db.PerformanceNotifications.SingleAsync();
        Assert.Equal("EmployeeObjectivePlan", stored.SubjectType);
        Assert.Equal(subjectId, stored.SubjectId);
        Assert.Equal("/performance/plan-approvals/c/p", stored.NavigationRoute);
    }

    [Fact]
    public async Task UnreadCount_ReflectsState()
    {
        var recipient = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var notifier = new PerformanceNotifier(db, tenant);
        await notifier.NotifyAsync(recipient, PerformanceNotificationType.PlanApproved, "t", "m", dedupKey: "a");
        await notifier.NotifyAsync(recipient, PerformanceNotificationType.PlanApproved, "t", "m", dedupKey: "b");
        await notifier.NotifyAsync(recipient, PerformanceNotificationType.PlanApproved, "t", "m", dedupKey: "c");

        var currentUser = new StubCurrentUserContext { EmployeeId = recipient };
        var count = await new GetUnreadNotificationCountQueryHandler(db, currentUser)
            .Handle(new GetUnreadNotificationCountQuery(), CancellationToken.None);
        Assert.Equal(3, count);
    }

    [Fact]
    public async Task MarkRead_AlreadyRead_IsNoOp()
    {
        var recipient = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var notifier = new PerformanceNotifier(db, tenant);
        await notifier.NotifyAsync(recipient, PerformanceNotificationType.PlanApproved, "t", "m", dedupKey: "a");
        var notification = await db.PerformanceNotifications.SingleAsync();

        var currentUser = new StubCurrentUserContext { EmployeeId = recipient };
        var handler = new MarkNotificationReadCommandHandler(db, currentUser);
        var first = await handler.Handle(new MarkNotificationReadCommand(notification.Id), CancellationToken.None);
        var readAt = (await db.PerformanceNotifications.SingleAsync()).ReadAt;
        var second = await handler.Handle(new MarkNotificationReadCommand(notification.Id), CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal(readAt, (await db.PerformanceNotifications.SingleAsync()).ReadAt);
    }

    [Fact]
    public async Task Notify_IsTenantScoped()
    {
        var dbName = $"notify-tenant-{Guid.NewGuid()}";
        var recipient = Guid.NewGuid();

        using (var db = PerformanceTestContext.Create(TenantId, out var tenant, dbName))
        {
            await new PerformanceNotifier(db, tenant).NotifyAsync(
                recipient, PerformanceNotificationType.PlanApproved, "t", "m", dedupKey: "x");
        }

        // A different tenant sees nothing under the global query filter.
        using var otherTenantDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, dbName);
        Assert.Equal(0, await otherTenantDb.PerformanceNotifications.CountAsync());
    }
}
