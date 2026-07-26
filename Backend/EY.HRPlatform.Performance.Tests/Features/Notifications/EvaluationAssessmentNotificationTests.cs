using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Jobs;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Notifications;

/// <summary>Task 8.3: assessment-event notifications (recipient + deep link + dedup) and reminder sweeps.</summary>
public class EvaluationAssessmentNotificationTests
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

    private static async Task<PerformanceNotification?> SingleNotificationAsync(
        ServiceProvider provider, Guid recipientId, PerformanceNotificationType type)
    {
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        return await db.PerformanceNotifications.IgnoreQueryFilters()
            .SingleOrDefaultAsync(n => n.RecipientEmployeeId == recipientId && n.Type == type);
    }

    [Fact]
    public async Task SelfSubmitted_NotifiesReviewer_WithParticipantDeepLink()
    {
        var roundId = Guid.NewGuid(); var participantId = Guid.NewGuid(); var reviewerId = Guid.NewGuid();
        await using var provider = BuildProvider($"notif-submit-{Guid.NewGuid()}");
        using (var scope = provider.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IPublisher>().Publish(
                new EvaluationSelfAssessmentSubmittedEvent(TenantId, roundId, Guid.NewGuid(), participantId, "Pat", reviewerId, "Rev"));

        var n = await SingleNotificationAsync(provider, reviewerId, PerformanceNotificationType.EvaluationSelfAssessmentSubmitted);
        Assert.NotNull(n);
        Assert.Equal($"/team-evaluations/{roundId}/{participantId}", n!.NavigationRoute);
    }

    [Fact]
    public async Task SelfReopened_NotifiesEmployee_WithReasonAndMyDeepLink()
    {
        var roundId = Guid.NewGuid(); var participantId = Guid.NewGuid();
        await using var provider = BuildProvider($"notif-reopen-{Guid.NewGuid()}");
        using (var scope = provider.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IPublisher>().Publish(
                new EvaluationSelfAssessmentReopenedEvent(TenantId, roundId, Guid.NewGuid(), participantId, "Pat", "Please add detail"));

        var n = await SingleNotificationAsync(provider, participantId, PerformanceNotificationType.EvaluationSelfAssessmentReopened);
        Assert.NotNull(n);
        Assert.Equal($"/my-evaluations/{roundId}", n!.NavigationRoute);
        Assert.Contains("Please add detail", n.Message);
    }

    [Fact]
    public async Task Finalized_NotifiesEmployee_WithMyDeepLink()
    {
        var roundId = Guid.NewGuid(); var participantId = Guid.NewGuid(); var managerAssignmentId = Guid.NewGuid();
        await using var provider = BuildProvider($"notif-finalized-{Guid.NewGuid()}");
        using (var scope = provider.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IPublisher>().Publish(
                new EvaluationFinalizedEvent(TenantId, roundId, managerAssignmentId, participantId, "Pat", Guid.NewGuid(), "Rev", 3.7m, 4));

        var n = await SingleNotificationAsync(provider, participantId, PerformanceNotificationType.EvaluationFinalized);
        Assert.NotNull(n);
        Assert.Equal($"/my-evaluations/{roundId}", n!.NavigationRoute);
    }

    [Fact]
    public async Task Acknowledged_NotifiesReviewer_AndIsDedupedOnRepublish()
    {
        var roundId = Guid.NewGuid(); var participantId = Guid.NewGuid(); var reviewerId = Guid.NewGuid();
        var managerAssignmentId = Guid.NewGuid();
        await using var provider = BuildProvider($"notif-ack-{Guid.NewGuid()}");
        var evt = new EvaluationAcknowledgedEvent(TenantId, roundId, managerAssignmentId, participantId, "Pat", reviewerId, "Rev");
        using (var scope = provider.CreateScope())
        {
            var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();
            await publisher.Publish(evt);
            await publisher.Publish(evt);
        }

        using var verify = provider.CreateScope();
        var db = verify.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var notifications = await db.PerformanceNotifications.IgnoreQueryFilters()
            .Where(n => n.RecipientEmployeeId == reviewerId && n.Type == PerformanceNotificationType.EvaluationAcknowledged)
            .ToListAsync();
        Assert.Single(notifications);
        Assert.Equal($"/team-evaluations/{roundId}/{participantId}", notifications[0].NavigationRoute);
    }

    [Fact]
    public async Task ReminderSweep_RunTwice_ProducesNoDuplicates_AndSkipsFinalized()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"eval-reminder-{Guid.NewGuid()}";
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<ICurrentUserContext>(_ => new StubCurrentUserContext());
        services.AddDbContext<PerformanceDbContext>(o => o.UseInMemoryDatabase(dbName), ServiceLifetime.Scoped);
        services.Configure<ReminderOptions>(o => { o.Enabled = true; o.SweepIntervalMinutes = 60; o.DueSoonWindowDays = 5; });
        await using var provider = services.BuildServiceProvider();

        using (var scope = provider.CreateScope())
        {
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            // Launched round with a near-future manager deadline so the sweep fires.
            await EvaluationTestScenario.SeedAndLaunchFreshAsync(
                db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly, ManagerDeadline: DateTime.UtcNow.AddDays(2)));
        }

        var job = new EvaluationDeadlineReminderJob(
            provider, provider.GetRequiredService<IOptions<ReminderOptions>>(),
            NullLogger<EvaluationDeadlineReminderJob>.Instance);

        var first = await job.ExecuteAsync(CancellationToken.None);
        var second = await job.ExecuteAsync(CancellationToken.None);

        Assert.True(first > 0);
        Assert.Equal(0, second);

        using var verify = provider.CreateScope();
        verify.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var vdb = verify.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var reminders = await vdb.PerformanceNotifications
            .Where(n => n.Type == PerformanceNotificationType.EvaluationDeadlineDueSoon
                || n.Type == PerformanceNotificationType.EvaluationDeadlineOverdue).CountAsync();
        Assert.Equal(first, reminders);
    }
}
