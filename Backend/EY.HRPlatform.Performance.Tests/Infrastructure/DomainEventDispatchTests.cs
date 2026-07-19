using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

public class DomainEventDispatchTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private sealed class CollectingPublisher : IPublisher
    {
        public List<INotification> Published { get; } = new();

        public Task Publish(object notification, CancellationToken cancellationToken = default)
        {
            if (notification is INotification n) Published.Add(n);
            return Task.CompletedTask;
        }

        public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
            where TNotification : INotification
        {
            Published.Add(notification);
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingPublisher : IPublisher
    {
        public int Calls { get; private set; }
        public Task Publish(object notification, CancellationToken cancellationToken = default)
        {
            Calls++;
            throw new InvalidOperationException("handler blew up");
        }

        public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
            where TNotification : INotification
        {
            Calls++;
            throw new InvalidOperationException("handler blew up");
        }
    }

    private static PerformanceDbContext CreateContext(IPublisher publisher, string dbName, out TenantContext tenant)
    {
        var tc = new TenantContext();
        tc.SetTenant(TenantId);
        tenant = tc;
        var interceptor = new DomainEventDispatchInterceptor(
            publisher, NullLogger<DomainEventDispatchInterceptor>.Instance);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(dbName)
            .AddInterceptors(interceptor)
            .Options;
        return new PerformanceDbContext(options, tc);
    }

    private static PerformanceCycle ActiveCycleEndingInPast()
    {
        var start = DateTime.UtcNow.AddDays(-30);
        var end = DateTime.UtcNow.AddDays(-1);
        return TestCycles.Create(TenantId, "FY Past", PerformanceCycleType.Annual, start, end).ForceActive();
    }

    [Fact]
    public async Task Dispatch_AfterCommit_PublishesEventAndClearsAggregate()
    {
        var publisher = new CollectingPublisher();
        var dbName = $"dispatch-{Guid.NewGuid()}";
        await using var db = CreateContext(publisher, dbName, out _);

        var cycle = ActiveCycleEndingInPast();
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        publisher.Published.Clear();

        cycle.Close(DateTime.UtcNow);
        await db.SaveChangesAsync();

        Assert.Contains(publisher.Published, e => e is PerformanceCycleClosedEvent);
        Assert.Empty(cycle.DomainEvents);
    }

    [Fact]
    public async Task Dispatch_HandlerFailureAfterCommit_DoesNotRollBackOrThrow()
    {
        var publisher = new ThrowingPublisher();
        var dbName = $"dispatch-fail-{Guid.NewGuid()}";
        await using var db = CreateContext(publisher, dbName, out _);

        var cycle = ActiveCycleEndingInPast();
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        cycle.Close(DateTime.UtcNow);
        // Handler throws post-commit, but SaveChanges must succeed and the change must persist.
        await db.SaveChangesAsync();

        Assert.True(publisher.Calls > 0);
        var stored = await db.PerformanceCycles.SingleAsync(c => c.Id == cycle.Id);
        Assert.Equal(PerformanceCycleStatus.Closed, stored.Status);
    }

    [Fact]
    public async Task NoDispatch_WhenSaveFails()
    {
        var publisher = new CollectingPublisher();
        var dbName = $"dispatch-nosave-{Guid.NewGuid()}";
        await using var db = CreateContext(publisher, dbName, out _);

        // Seed an append-only activity entry we will illegally mutate to force SaveChanges to throw.
        var entry = ActivityLogEntry.Create(TenantId, Guid.NewGuid(), "Actor", "Seed", "PerformanceCycle", Guid.NewGuid());
        db.ActivityLogEntries.Add(entry);
        await db.SaveChangesAsync();
        publisher.Published.Clear();

        var cycle = ActiveCycleEndingInPast();
        db.PerformanceCycles.Add(cycle);
        cycle.Close(DateTime.UtcNow); // raises a domain event

        // Stage an append-only violation so the SaveChanges override throws before base save.
        db.Entry(entry).Property(e => e.Action).CurrentValue = "Tampered";

        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());

        Assert.Empty(publisher.Published);
        Assert.NotEmpty(cycle.DomainEvents); // not cleared because dispatch never ran
    }
}
