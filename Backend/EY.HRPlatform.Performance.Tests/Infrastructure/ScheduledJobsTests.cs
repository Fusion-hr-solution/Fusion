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

public class ScheduledJobsTests
{
    private sealed class AlwaysAcquireLock : IAdvisoryLock
    {
        public Task<IAsyncDisposable?> TryAcquireAsync(string key, CancellationToken cancellationToken)
            => Task.FromResult<IAsyncDisposable?>(new NoopHandle());

        private sealed class NoopHandle : IAsyncDisposable
        {
            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        }
    }

    private sealed class ContendedLock : IAdvisoryLock
    {
        public Task<IAsyncDisposable?> TryAcquireAsync(string key, CancellationToken cancellationToken)
            => Task.FromResult<IAsyncDisposable?>(null);
    }

    private sealed class CountingJob(string name) : IScheduledJob
    {
        public int Executions { get; private set; }
        public string Name => name;
        public TimeSpan Interval => TimeSpan.FromMinutes(5);
        public Task<int> ExecuteAsync(CancellationToken cancellationToken)
        {
            Executions++;
            return Task.FromResult(3);
        }
    }

    private static ServiceProvider BuildProvider(string dbName)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<ICurrentUserContext>(_ => new StubCurrentUserContext());
        services.AddDbContext<PerformanceDbContext>(o => o.UseInMemoryDatabase(dbName), ServiceLifetime.Scoped);
        services.Configure<ReminderOptions>(o => { o.Enabled = true; o.SweepIntervalMinutes = 60; o.DueSoonWindowDays = 3; });
        services.Configure<ScheduledJobsOptions>(o => { o.Enabled = true; o.InactivityThresholdDays = 7; });
        services.AddSingleton<IScheduledJob, DeadlineReminderJob>();
        return services.BuildServiceProvider();
    }

    private static void SeedOverdueCycle(ServiceProvider provider, Guid tenantId)
    {
        using var scope = provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();

        var start = DateTime.UtcNow.AddDays(-30);
        var end = DateTime.UtcNow.AddDays(30);
        var cycle = TestCycles.Create(tenantId, "FY", PerformanceCycleType.Annual, start, end,
            objectiveSettingDeadline: DateTime.UtcNow.AddDays(-2)).ForceLaunched();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(
            tenantId, cycle.Id, Guid.NewGuid(), "Emp One", Guid.NewGuid(), "Mgr"));
        db.SaveChanges();
    }

    [Fact]
    public async Task DeadlineReminderJob_GeneratesReminders_PerTenantIsolated()
    {
        var dbName = $"jobs-deadline-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        SeedOverdueCycle(provider, tenantA);
        SeedOverdueCycle(provider, tenantB);

        var job = provider.GetServices<IScheduledJob>().OfType<DeadlineReminderJob>().Single();
        var affected = await job.ExecuteAsync(CancellationToken.None);

        Assert.Equal(2, affected);
        using var scope = provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantA);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var tenantANotifications = await db.PerformanceNotifications.ToListAsync();
        Assert.Single(tenantANotifications);
        Assert.All(tenantANotifications, n => Assert.Equal(tenantA, n.TenantId));
    }

    [Fact]
    public async Task DeadlineReminderJob_ReRun_IsIdempotent()
    {
        var dbName = $"jobs-idem-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var tenantId = Guid.NewGuid();
        SeedOverdueCycle(provider, tenantId);

        var job = provider.GetServices<IScheduledJob>().OfType<DeadlineReminderJob>().Single();
        var first = await job.ExecuteAsync(CancellationToken.None);
        var second = await job.ExecuteAsync(CancellationToken.None);

        Assert.Equal(1, first);
        Assert.Equal(0, second);
    }

    [Fact]
    public async Task Runner_Tick_AcquiresLock_RunsJob_RecordsSucceeded()
    {
        var dbName = $"runner-ok-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var job = new CountingJob("counting");
        var runner = new ScheduledJobRunner(
            provider, new IScheduledJob[] { job }, new AlwaysAcquireLock(),
            Options.Create(new ScheduledJobsOptions()), NullLogger<ScheduledJobRunner>.Instance);

        var status = await runner.TickAsync(job, CancellationToken.None);

        Assert.Equal(ScheduledJobRunStatus.Succeeded, status);
        Assert.Equal(1, job.Executions);
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var run = await db.ScheduledJobRuns.SingleAsync(r => r.JobName == "counting");
        Assert.Equal(ScheduledJobRunStatus.Succeeded, run.Status);
        Assert.Equal(3, run.ItemsAffected);
    }

    [Fact]
    public async Task Runner_Tick_UnderContention_SkipsAndRecords()
    {
        var dbName = $"runner-skip-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var job = new CountingJob("counting");
        var runner = new ScheduledJobRunner(
            provider, new IScheduledJob[] { job }, new ContendedLock(),
            Options.Create(new ScheduledJobsOptions()), NullLogger<ScheduledJobRunner>.Instance);

        var status = await runner.TickAsync(job, CancellationToken.None);

        Assert.Equal(ScheduledJobRunStatus.Skipped, status);
        Assert.Equal(0, job.Executions);
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var run = await db.ScheduledJobRuns.SingleAsync(r => r.JobName == "counting");
        Assert.Equal(ScheduledJobRunStatus.Skipped, run.Status);
    }

    [Fact]
    public async Task Runner_Disabled_DoesNotRunJobs()
    {
        var dbName = $"runner-disabled-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);
        var job = new CountingJob("counting");
        var runner = new ScheduledJobRunner(
            provider, new IScheduledJob[] { job }, new AlwaysAcquireLock(),
            Options.Create(new ScheduledJobsOptions { Enabled = false }), NullLogger<ScheduledJobRunner>.Instance);

        await runner.StartAsync(CancellationToken.None);
        await runner.StopAsync(CancellationToken.None);

        Assert.Equal(0, job.Executions);
    }
}
