using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public sealed class CampaignDraftCommandTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task CreateDraft_CopiesCurrentTenantPlanningRulesIntoSnapshot()
    {
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var dbName = $"campaign-draft-create-{Guid.NewGuid()}";

        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var policy = TenantObjectivePolicy.Create(TenantId);
            policy.ApplyConfiguration(
                5,
                "[25,50,75,100]",
                "Quantitative,Qualitative",
                UserId,
                "HR Admin",
                "Initial planning rules");
            seed.TenantObjectivePolicies.Add(policy);
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var handler = new CreateCycleCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext { UserId = UserId, FullName = "HR Admin" },
            Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new CreateCycleCommand(
                "FY26 Planning",
                "Focus on client delivery",
                2026,
                Start,
                Start.AddDays(14),
                Start.AddDays(21),
                Start.AddDays(30)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.Draft.ToString(), result.Value.Status);
        Assert.Equal("fy26-planning-2026", result.Value.Slug);
        Assert.Equal(5, result.Value.PlanningRulesSnapshot!.MaxObjectiveCount);
        Assert.Equal("[25,50,75,100]", result.Value.PlanningRulesSnapshot.AllowedWeightMenu);

        var stored = await db.PerformanceCycles.SingleAsync(cycle => cycle.Id == result.Value.Id);
        Assert.Equal(UserId, stored.OwnerUserId);
        Assert.Equal("fy26-planning-2026", stored.Slug);
        Assert.Equal(2, await db.PerformanceCycleAuditEvents.CountAsync(a => a.CycleId == stored.Id));
    }

    [Fact]
    public async Task CreateDraft_DerivesUniqueSlugWhenBaseIsTaken()
    {
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var dbName = $"campaign-slug-dedup-{Guid.NewGuid()}";

        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var policy = TenantObjectivePolicy.Create(TenantId);
            policy.ApplyConfiguration(5, "[25,50,75,100]", "Quantitative,Qualitative", UserId, "HR Admin", "Initial planning rules");
            seed.TenantObjectivePolicies.Add(policy);
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var handler = new CreateCycleCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext { UserId = UserId, FullName = "HR Admin" },
            Options.Create(new ReminderOptions()));

        var first = await handler.Handle(
            new CreateCycleCommand("Annual Planning", null, 2026, Start, Start.AddDays(14), Start.AddDays(21), Start.AddDays(30)),
            CancellationToken.None);
        // A different name that slugifies to the same base competes for the same slug stem.
        var second = await handler.Handle(
            new CreateCycleCommand("Annual  Planning!", null, 2026, Start, Start.AddDays(14), Start.AddDays(21), Start.AddDays(30)),
            CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal("annual-planning-2026", first.Value.Slug);
        Assert.Equal("annual-planning-2026-2", second.Value.Slug);
    }

    [Fact]
    public async Task CreateDraft_WithoutAppliedTenantPlanningRules_IsValidationFailure()
    {
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);

        await using var db = PerformanceTestContext.Create(tenantContext);
        var handler = new CreateCycleCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext { UserId = UserId, FullName = "HR Admin" },
            Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new CreateCycleCommand(
                "FY26 Planning",
                null,
                2026,
                Start,
                Start.AddDays(14),
                Start.AddDays(21),
                Start.AddDays(30)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Campaign.PlanningRulesMissing", result.Error.Code);
        Assert.False(await db.PerformanceCycles.AnyAsync());
    }

    [Fact]
    public async Task AddStrategicObjective_IsCampaignBoundAndAudited()
    {
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var dbName = $"campaign-objective-add-{Guid.NewGuid()}";
        Guid cycleId;

        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.CreateDraft(
                TenantId,
                "FY26 Planning",
                "fy26-planning",
                2026,
                null,
                UserId,
                "HR Admin",
                Start,
                Start.AddDays(14),
                Start.AddDays(21),
                Start.AddDays(30),
                CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start));
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            cycleId = cycle.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var handler = new AddCampaignStrategicObjectiveCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext { UserId = UserId, FullName = "HR Admin" });

        var result = await handler.Handle(
            new AddCampaignStrategicObjectiveCommand(cycleId, "Improve client delivery", null, "Consulting"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsActive);
        Assert.True(await db.CampaignStrategicObjectives.AnyAsync(item => item.CycleId == cycleId));
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(a =>
            a.CycleId == cycleId && a.Action == PerformanceCycleAuditAction.StrategicObjectiveAdded));
    }

    [Fact]
    public async Task StaleDraftEdit_IsRejectedBeforeMutation()
    {
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);
        var dbName = $"campaign-draft-concurrency-{Guid.NewGuid()}";
        Guid cycleId;
        uint version;

        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.CreateDraft(
                TenantId,
                "FY26 Planning",
                "fy26-planning",
                2026,
                null,
                UserId,
                "HR Admin",
                Start,
                Start.AddDays(14),
                Start.AddDays(21),
                Start.AddDays(30),
                CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start));
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            cycleId = cycle.Id;
            version = cycle.Version;
        }

        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var handler = new UpdateCycleCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext { UserId = UserId, FullName = "HR Admin" },
            Options.Create(new ReminderOptions()));

        await Assert.ThrowsAsync<ConcurrencyException>(() =>
            handler.Handle(
                new UpdateCycleCommand(
                    cycleId,
                    version + 1,
                    "Changed",
                    null,
                    2026,
                    Start,
                    Start.AddDays(14),
                    Start.AddDays(21),
                    Start.AddDays(30)),
                CancellationToken.None));

        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        var stored = await verify.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == cycleId);
        Assert.Equal("FY26 Planning", stored.Name);
    }
}
