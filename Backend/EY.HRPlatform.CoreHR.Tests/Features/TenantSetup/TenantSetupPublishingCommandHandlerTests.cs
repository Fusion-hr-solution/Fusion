using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.CompleteTenantSetup;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.PublishTenantStructure;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSetup;

public class TenantSetupPublishingCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid ActorUserId = Guid.NewGuid();
    private const string SettingsJson = """{"orgUnitTypes":["Department","Team"]}""";

    [Fact]
    public async Task Handle_WithApprovedDraft_PublishesSetupReplacesLiveOrgUnitsAndUnlocksCore()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", false);

            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSetupActivities.Add(
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Approved,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    false));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var rootDraftUnit = DraftOrgUnit.Create(
                TenantId,
                "ENG",
                "Engineering",
                "department",
                null,
                null,
                null,
                null);
            seedContext.DraftOrgUnits.Add(rootDraftUnit);
            await seedContext.SaveChangesAsync();

            seedContext.DraftOrgUnits.Add(
                DraftOrgUnit.Create(
                    TenantId,
                    "ENG-PLT",
                    "Platform Team",
                    "team",
                    null,
                    null,
                    null,
                    rootDraftUnit.Id));

            seedContext.OrgUnits.AddRange(
                OrgUnit.Create(TenantId, "OLD", "Old Structure", "Department", null),
                OrgUnit.Create(TenantId, "OPS", "Operations", "Department", null));
            await seedContext.SaveChangesAsync();

            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new PublishTenantStructureCommandHandler(context);

        var result = await handler.Handle(
            new PublishTenantStructureCommand(
                expectedVersion,
                ActorUserId,
                "Jordan Approver",
                "HRAdmin",
                false),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("operational", result.Value.CurrentPhase);
        Assert.NotNull(result.Value.StructurallyPublishedAt);
        Assert.NotNull(result.Value.OperationalAt);
        Assert.Contains(result.Value.RecentActivities, activity => activity.ActivityType == "published");
        Assert.Contains(result.Value.RecentActivities, activity => activity.ActivityType == "completed");

        var liveUnits = await context.OrgUnits
            .AsNoTracking()
            .OrderBy(unit => unit.Code)
            .ToListAsync();

        var savedState = await context.TenantSetupStates.AsNoTracking().FirstAsync();

        Assert.Equal(2, liveUnits.Count);
        Assert.Equal(["ENG", "ENG-PLT"], liveUnits.Select(unit => unit.Code).ToArray());
        Assert.Equal("Department", liveUnits.Single(unit => unit.Code == "ENG").Type);
        Assert.Equal("Team", liveUnits.Single(unit => unit.Code == "ENG-PLT").Type);
        Assert.Equal(
            liveUnits.Single(unit => unit.Code == "ENG").Id,
            liveUnits.Single(unit => unit.Code == "ENG-PLT").ParentId);
        Assert.Equal(TenantSetupPhase.Operational, savedState.CurrentPhase);
    }

    [Fact]
    public async Task Handle_WithPublishBlockingIssues_ThrowsInvalidTenantSetupStateException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", false);

            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSetupActivities.Add(
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Approved,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    false));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            seedContext.DraftOrgUnits.Add(
                DraftOrgUnit.Create(
                    TenantId,
                    new string('A', 51),
                    "Engineering",
                    "department",
                    null,
                    null,
                    null,
                    null));
            await seedContext.SaveChangesAsync();

            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new PublishTenantStructureCommandHandler(context);

        var ex = await Assert.ThrowsAsync<InvalidTenantSetupStateException>(
            () => handler.Handle(
                new PublishTenantStructureCommand(
                    expectedVersion,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    false),
                CancellationToken.None));

        Assert.Contains("remaining structure issues", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_WithPublishedStructure_CompletesSetupAndRecordsActivity()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", true);
            state.Publish();

            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSetupActivities.AddRange(
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Approved,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    true),
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Published,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    true));
            await seedContext.SaveChangesAsync();

            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CompleteTenantSetupCommandHandler(context);

        var result = await handler.Handle(
            new CompleteTenantSetupCommand(
                expectedVersion,
                ActorUserId,
                "Jordan Approver",
                "HRAdmin",
                true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("operational", result.Value.CurrentPhase);
        Assert.NotNull(result.Value.OperationalAt);
        Assert.Contains(result.Value.RecentActivities, activity => activity.ActivityType == "completed");

        var savedState = await context.TenantSetupStates.AsNoTracking().FirstAsync();
        Assert.Equal(TenantSetupPhase.Operational, savedState.CurrentPhase);

        var activities = await context.TenantSetupActivities
            .AsNoTracking()
            .ToListAsync();

        Assert.Equal(3, activities.Count);
        Assert.Contains(activities, activity => activity.ActivityType == TenantSetupActivityType.Completed);
    }
}