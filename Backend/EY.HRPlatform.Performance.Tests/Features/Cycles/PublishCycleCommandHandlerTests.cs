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

public class PublishCycleCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private sealed class FakeResolver(IReadOnlyList<CoreEmployeeSummary> members) : IPerformancePopulationResolver
    {
        public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(PerformanceCycle cycle, CancellationToken cancellationToken)
            => Task.FromResult(members);
    }

    private static (Guid CycleId, uint Version) SeedDraft(string dbName, TenantContext tenantContext)
    {
        using var seed = PerformanceTestContext.Create(tenantContext, dbName);
        var cycle = PerformanceCycle.Create(
            TenantId, "FY26", PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        seed.PerformanceCycles.Add(cycle);
        seed.SaveChanges();
        return (cycle.Id, cycle.Version);
    }

    [Fact]
    public async Task Publish_PreparesParticipantsWithoutNotifyingThemBeforeActivation()
    {
        var dbName = $"perf-publish-{Guid.NewGuid()}";
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var (cycleId, version) = SeedDraft(dbName, tenantContext);

        var members = new List<CoreEmployeeSummary>
        {
            FakeCoreWorkforceClient.Employee(Guid.NewGuid(), "Alice Adams"),
            FakeCoreWorkforceClient.Employee(Guid.NewGuid(), "Bob Brown"),
        };

        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var handler = new PublishCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(),
            new FakeResolver(members), new FakeCoreWorkforceClient(), Options.Create(new ReminderOptions()));

        var result = await handler.Handle(new PublishCycleCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.AssignmentPreparation.ToString(), result.Value.Status);

        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        Assert.Equal(2, await verify.PerformanceCycleParticipants.CountAsync(p => p.CycleId == cycleId));
        Assert.Equal(0, await verify.PerformanceNotifications
            .CountAsync(n => n.CycleId == cycleId && n.Type == PerformanceNotificationType.CyclePublished));
        Assert.True(await verify.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.AssignmentPreparationStarted));
    }

    [Fact]
    public async Task Publish_WithEmptyPopulation_Fails()
    {
        var dbName = $"perf-publish-empty-{Guid.NewGuid()}";
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var (cycleId, version) = SeedDraft(dbName, tenantContext);

        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var handler = new PublishCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(),
            new FakeResolver([]), new FakeCoreWorkforceClient(), Options.Create(new ReminderOptions()));

        var result = await handler.Handle(new PublishCycleCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.EmptyPopulation", result.Error.Code);

        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        var stored = await verify.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == cycleId);
        Assert.Equal(PerformanceCycleStatus.Draft, stored.Status);
    }
}
