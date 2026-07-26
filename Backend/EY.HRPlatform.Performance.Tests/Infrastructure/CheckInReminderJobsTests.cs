using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Jobs;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

/// <summary>
/// Idempotency and tenant-isolation coverage for the check-in follow-up reminder sweep. The reminder
/// jobs are pure read-then-notify: they never persist derived overdue state, and their dedup keys
/// make repeated ticks a no-op for the same due-date bucket.
/// </summary>
public class CheckInReminderJobsTests
{
    private static ServiceProvider BuildProvider(string dbName)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<ICurrentUserContext>(_ => new StubCurrentUserContext());
        services.AddDbContext<PerformanceDbContext>(o => o.UseInMemoryDatabase(dbName), ServiceLifetime.Scoped);
        services.Configure<ReminderOptions>(o =>
        {
            o.Enabled = true;
            o.SweepIntervalMinutes = 60;
            o.FollowUpActionDueWindowDays = 3;
        });
        services.AddSingleton<IScheduledJob, FollowUpActionDueReminderJob>();
        return services.BuildServiceProvider();
    }

    private static void SeedDueAction(ServiceProvider provider, Guid tenantId)
    {
        using var scope = provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();

        var action = CheckInFollowUpAction.Create(
            tenantId,
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Share the updated delivery plan",
            FollowUpActionOwnerKind.Employee,
            Guid.NewGuid(),
            "Alice Employee",
            DateTime.UtcNow.AddDays(1),
            null,
            DateTime.UtcNow);
        db.CheckInFollowUpActions.Add(action);
        db.SaveChanges();
    }

    [Fact]
    public async Task FollowUpActionDueReminderJob_GeneratesReminders_PerTenantIsolated()
    {
        var dbName = $"checkin-reminders-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        SeedDueAction(provider, tenantA);
        SeedDueAction(provider, tenantB);

        var job = provider.GetServices<IScheduledJob>().OfType<FollowUpActionDueReminderJob>().Single();
        var affected = await job.ExecuteAsync(CancellationToken.None);

        Assert.Equal(2, affected);

        using var scope = provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantA);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var tenantANotifications = await db.PerformanceNotifications.ToListAsync();
        Assert.Single(tenantANotifications);
        Assert.All(tenantANotifications, n => Assert.Equal(tenantA, n.TenantId));
        Assert.Equal(PerformanceNotificationType.FollowUpActionDueSoon, tenantANotifications[0].Type);
    }

    [Fact]
    public async Task FollowUpActionDueReminderJob_ReRun_IsIdempotent()
    {
        var dbName = $"checkin-reminders-idem-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var tenantId = Guid.NewGuid();
        SeedDueAction(provider, tenantId);

        var job = provider.GetServices<IScheduledJob>().OfType<FollowUpActionDueReminderJob>().Single();
        var first = await job.ExecuteAsync(CancellationToken.None);
        var second = await job.ExecuteAsync(CancellationToken.None);

        Assert.Equal(1, first);
        Assert.Equal(0, second);
    }
}
