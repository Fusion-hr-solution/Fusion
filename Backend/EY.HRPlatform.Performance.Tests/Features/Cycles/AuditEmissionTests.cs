using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-04 guardrail 4: audit emission + publish gates — asserts publish is blocked
/// without retention policy and without exception owner, and that a governed action
/// emits a PerformanceCycleAuditEvent.
/// </summary>
public class AuditEmissionTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private sealed class FakeResolver(IReadOnlyList<CoreEmployeeSummary> members) : IPerformancePopulationResolver
    {
        public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(PerformanceCycle cycle, CancellationToken cancellationToken)
            => Task.FromResult(members);
    }

    [Fact]
    public async Task PublishWithoutRetentionPolicy_IsBlocked()
    {
        var now = DateTime.UtcNow;
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);

        // Seed: Draft cycle WITHOUT calling ConfigureGovernance (no retention policy)
        var dbName = $"perf-audit-noretention-{Guid.NewGuid()}";
        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.Create(
                TenantId, "FY26 No Retention", PerformanceCycleType.Annual,
                now.AddDays(-1), now.AddDays(10));
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
        }

        // Act: attempt to publish without governance configured
        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var storedCycle = await db.PerformanceCycles.SingleAsync();
        var cycleId = storedCycle.Id;
        var version = storedCycle.Version;

        var handler = new PublishCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(),
            new FakeResolver([]), new FakeCoreWorkforceClient(), Options.Create(new ReminderOptions()));
        var result = await handler.Handle(new PublishCycleCommand(cycleId, version), CancellationToken.None);

        // Assert: publish blocked without retention policy
        Assert.True(result.IsFailure);

        // Verify cycle still in Draft
        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        var stored = await verify.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == cycleId);
        Assert.Equal(PerformanceCycleStatus.Draft, stored.Status);
    }

    [Fact]
    public void PublishWithoutExceptionOwner_IsBlocked()
    {
        var now = DateTime.UtcNow;

        // ConfigureGovernance rejects empty exception owners list at domain level
        var cycle = PerformanceCycle.Create(
            TenantId, "FY26 No Exception Owner", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));

        var ex = Assert.Throws<ArgumentException>(() =>
            cycle.ConfigureGovernance(
                Guid.NewGuid(), false, 3,
                CampaignFeedbackVisibility.AnonymousToSubject,
                []));
        Assert.Contains("exceptionOwnerEmployeeIds", ex.Message);
    }

    [Fact]
    public async Task GovernedAction_EmitsAuditEvent()
    {
        var now = DateTime.UtcNow;
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);

        // Seed: Draft cycle with governance configured
        var dbName = $"perf-audit-governed-{Guid.NewGuid()}";
        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.Create(
                TenantId, "FY26 Audit Test", PerformanceCycleType.Annual,
                now.AddDays(-1), now.AddDays(10));
            cycle.ConfigureGovernance(
                Guid.NewGuid(), false, 3,
                CampaignFeedbackVisibility.AnonymousToSubject,
                [Guid.NewGuid()]);
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
        }

        // Act: successful publish
        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var storedCycle = await db.PerformanceCycles.SingleAsync();
        var cycleId = storedCycle.Id;
        var version = storedCycle.Version;

        var members = new List<CoreEmployeeSummary>
        {
            FakeCoreWorkforceClient.Employee(Guid.NewGuid(), "Alice"),
        };

        var handler = new PublishCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(),
            new FakeResolver(members), new FakeCoreWorkforceClient(), Options.Create(new ReminderOptions()));
        var result = await handler.Handle(new PublishCycleCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsSuccess);

        // Assert: audit event emitted for AssignmentPreparationStarted
        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        Assert.True(await verify.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.AssignmentPreparationStarted));
    }
}
