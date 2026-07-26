using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Performance.Tests.Features.Notifications;

public class PerformanceDomainEventHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private static ServiceProvider BuildProvider(string dbName)
    {
        var tenant = new TenantContext();
        tenant.SetTenant(TenantId);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(tenant);
        services.AddSingleton<ITenantContext>(tenant);
        services.AddScoped<ICurrentUserContext>(_ => new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });
        services.AddDbContext<PerformanceDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddScoped<IActivityLog, ActivityLogWriter>();
        services.AddScoped<IPerformanceNotifier, PerformanceNotifier>();
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<Program>());
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task PlanApproved_FansOutToActivityAndNotification()
    {
        var dbName = $"fanout-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();

        await using var provider = BuildProvider(dbName);
        using (var scope = provider.CreateScope())
        {
            var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();
            await publisher.Publish(new EmployeeObjectivePlanApprovedEvent(
                TenantId, planId, cycleId, employeeId, Guid.NewGuid(), "Manager Meg"));
        }

        using (var scope = provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            var activity = await db.ActivityLogEntries.IgnoreQueryFilters()
                .Where(a => a.SubjectId == planId && a.Action == "PlanApproved").ToListAsync();
            var notifications = await db.PerformanceNotifications.IgnoreQueryFilters()
                .Where(n => n.RecipientEmployeeId == employeeId && n.Type == PerformanceNotificationType.PlanApproved)
                .ToListAsync();

            Assert.Single(activity);
            Assert.Single(notifications);
            Assert.Equal("/my-objectives", notifications[0].NavigationRoute);
            Assert.Equal("EmployeeObjectivePlan", notifications[0].SubjectType);
        }
    }

    [Fact]
    public async Task PlanApproved_PublishedTwice_CreatesOneNotification()
    {
        var dbName = $"dup-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        // Same event instance => same EventId => dedup key stable across both publishes.
        var evt = new EmployeeObjectivePlanApprovedEvent(
            TenantId, planId, cycleId, employeeId, Guid.NewGuid(), "Manager Meg");

        await using var provider = BuildProvider(dbName);
        using (var scope = provider.CreateScope())
        {
            var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();
            await publisher.Publish(evt);
            await publisher.Publish(evt);
        }

        using (var scope = provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            var count = await db.PerformanceNotifications.IgnoreQueryFilters()
                .CountAsync(n => n.RecipientEmployeeId == employeeId && n.Type == PerformanceNotificationType.PlanApproved);
            Assert.Equal(1, count);
        }
    }
}
