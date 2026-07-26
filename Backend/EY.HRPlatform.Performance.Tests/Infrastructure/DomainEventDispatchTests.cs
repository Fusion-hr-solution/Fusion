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

    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>
    /// Builds a launched cycle with a draft two-objective plan ready to submit. Calling
    /// <see cref="EmployeeObjectivePlan.Submit"/> then raises a live domain event whose post-commit
    /// dispatch this suite exercises.
    /// </summary>
    private static (PerformanceCycle Cycle, EmployeeObjectivePlan Plan, PerformanceCycleParticipant Participant) SubmittablePlan()
    {
        var employeeId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var cycle = PerformanceCycle.CreateDraft(
            TenantId,
            "FY Dispatch",
            $"fy-dispatch-{Guid.NewGuid():N}",
            2026,
            null,
            Guid.NewGuid(),
            "Test Owner",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(300),
            CampaignPlanningRulesSnapshot.Capture(
                5, "0.40,0.60", "Quantitative,Qualitative", Guid.NewGuid(), Start));
        var strategic = cycle.AddStrategicObjective("Grow delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", managerId, "Mia Manager", false, null)],
            Start.AddDays(1));

        var participant = cycle.Participants.Single();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        plan.AddObjective(cycle, "Improve delivery quality", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 60, Start.AddDays(30), "Quantitative", "NPS", "60", "%", Start.AddDays(2));
        plan.AddObjective(cycle, "Coach peers", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 40, Start.AddDays(30), "Qualitative", null, null, null, Start.AddDays(2),
            successCriteria: "Two mentees onboarded");
        return (cycle, plan, participant);
    }

    [Fact]
    public async Task Dispatch_AfterCommit_PublishesEventAndClearsAggregate()
    {
        var publisher = new CollectingPublisher();
        var dbName = $"dispatch-{Guid.NewGuid()}";
        await using var db = CreateContext(publisher, dbName, out _);

        var (cycle, plan, participant) = SubmittablePlan();
        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.Add(plan);
        await db.SaveChangesAsync();
        publisher.Published.Clear();

        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        await db.SaveChangesAsync();

        Assert.Contains(publisher.Published, e => e is EmployeeObjectivePlanSubmittedEvent);
        Assert.Empty(plan.DomainEvents);
    }

    [Fact]
    public async Task Dispatch_HandlerFailureAfterCommit_DoesNotRollBackOrThrow()
    {
        var publisher = new ThrowingPublisher();
        var dbName = $"dispatch-fail-{Guid.NewGuid()}";
        await using var db = CreateContext(publisher, dbName, out _);

        var (cycle, plan, participant) = SubmittablePlan();
        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.Add(plan);
        await db.SaveChangesAsync();

        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        // Handler throws post-commit, but SaveChanges must succeed and the change must persist.
        await db.SaveChangesAsync();

        Assert.True(publisher.Calls > 0);
        var stored = await db.EmployeeObjectivePlans.SingleAsync(p => p.Id == plan.Id);
        Assert.Equal(PlanStatus.Submitted, stored.Status);
    }

    [Fact]
    public async Task NoDispatch_WhenSaveFails()
    {
        var publisher = new CollectingPublisher();
        var dbName = $"dispatch-nosave-{Guid.NewGuid()}";
        await using var db = CreateContext(publisher, dbName, out _);

        var (cycle, plan, participant) = SubmittablePlan();
        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.Add(plan);

        // Seed an append-only activity entry we will illegally mutate to force SaveChanges to throw.
        var entry = ActivityLogEntry.Create(TenantId, Guid.NewGuid(), "Actor", "Seed", "PerformanceCycle", Guid.NewGuid());
        db.ActivityLogEntries.Add(entry);
        await db.SaveChangesAsync();
        publisher.Published.Clear();

        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded); // raises a domain event

        // Stage an append-only violation so the SaveChanges override throws before base save.
        db.Entry(entry).Property(e => e.Action).CurrentValue = "Tampered";

        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());

        Assert.Empty(publisher.Published);
        Assert.NotEmpty(plan.DomainEvents); // not cleared because dispatch never ran
    }
}
