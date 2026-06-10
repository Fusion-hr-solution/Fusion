using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.CompleteTenantSetup;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.PublishTenantStructure;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ReopenTenantStructure;
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
    public async Task Handle_WithReadyDraft_PublishesSetupPreservesMatchingLiveOrgUnitsAndUnlocksCore()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;
        Guid existingEngineeringId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);

            seedContext.TenantSetupStates.Add(state);
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

            var existingEngineering = OrgUnit.Create(TenantId, "ENG", "Old Engineering", "Department", null);
            var operations = OrgUnit.Create(TenantId, "OPS", "Operations", "Department", null);
            seedContext.OrgUnits.AddRange(existingEngineering, operations);
            await seedContext.SaveChangesAsync();

            existingEngineeringId = existingEngineering.Id;

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
        Assert.Equal(3, result.Value.CurrentStep);
        Assert.True(result.Value.HasDraftStructure);
        Assert.True(result.Value.HasPublishedStructure);
        Assert.False(result.Value.RequiresRepublish);
        Assert.NotNull(result.Value.StructurallyPublishedAt);
        Assert.NotNull(result.Value.OperationalAt);
        Assert.Contains(result.Value.RecentActivities, activity => activity.ActivityType == "published");
        Assert.Contains(result.Value.RecentActivities, activity => activity.ActivityType == "completed");

        var liveUnits = await context.OrgUnits
            .AsNoTracking()
            .OrderBy(unit => unit.Code)
            .ToListAsync();

        var savedState = await context.TenantSetupStates.AsNoTracking().FirstAsync();

        Assert.Equal(3, liveUnits.Count);
        Assert.Equal(["ENG", "ENG-PLT", "OPS"], liveUnits.Select(unit => unit.Code).ToArray());
        Assert.Equal(existingEngineeringId, liveUnits.Single(unit => unit.Code == "ENG").Id);
        Assert.Equal("Department", liveUnits.Single(unit => unit.Code == "ENG").Type);
        Assert.Equal("Team", liveUnits.Single(unit => unit.Code == "ENG-PLT").Type);
        Assert.Equal(
            liveUnits.Single(unit => unit.Code == "ENG").Id,
            liveUnits.Single(unit => unit.Code == "ENG-PLT").ParentId);
        Assert.Equal(TenantSetupPhase.Operational, savedState.CurrentPhase);
        Assert.Equal(1, savedState.PublishedStructureVersion);
        Assert.False(liveUnits.Single(unit => unit.Code == "OPS").IsActive);
    }

    [Fact]
    public async Task Handle_WithRemovedLiveUnitAssignedToActiveEmployees_ThrowsInvalidTenantSetupStateException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);

            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            seedContext.DraftOrgUnits.Add(
                DraftOrgUnit.Create(
                    TenantId,
                    "ENG",
                    "Engineering",
                    "department",
                    null,
                    null,
                    null,
                    null));

            var legacyUnit = OrgUnit.Create(TenantId, "LEGACY", "Legacy Unit", "Department", null);
            seedContext.OrgUnits.Add(legacyUnit);
            await seedContext.SaveChangesAsync();

            var assignedEmployee = Employee.Create(
                TenantId,
                "Jordan",
                "Employee",
                "jordan.employee@example.com",
                DateTime.UtcNow,
                employeeNumber: "E-200");
            assignedEmployee.AssignOrgUnit(legacyUnit.Id);
            seedContext.Employees.Add(assignedEmployee);
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

        Assert.Contains("LEGACY", ex.Message, StringComparison.OrdinalIgnoreCase);
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

            seedContext.TenantSetupStates.Add(state);
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

    [Fact]
    public async Task Handle_WithOperationalSetup_ReopensDraftFromCurrentLiveStructure()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var rootLiveUnit = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            var childLiveUnit = OrgUnit.Create(TenantId, "PLT", "Platform", "Team", rootLiveUnit.Id);
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", true);
            state.Publish();
            state.Complete();

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
                    true),
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Completed,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    true));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            seedContext.OrgUnits.AddRange(rootLiveUnit, childLiveUnit);
            seedContext.DraftOrgUnits.Add(
                DraftOrgUnit.Create(
                    TenantId,
                    "OLD",
                    "Stale Draft",
                    "department",
                    null,
                    null,
                    null,
                    null));
            await seedContext.SaveChangesAsync();

            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new ReopenTenantStructureCommandHandler(context);

        var result = await handler.Handle(
            new ReopenTenantStructureCommand(
                expectedVersion,
                ActorUserId,
                "Alex Reviewer",
                "PlatformAdmin",
                true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("activated", result.Value.CurrentPhase);
        Assert.Equal(2, result.Value.CurrentStep);
        Assert.True(result.Value.HasDraftStructure);
        Assert.True(result.Value.HasPublishedStructure);
        Assert.True(result.Value.RequiresRepublish);

        var draftUnits = await context.DraftOrgUnits
            .AsNoTracking()
            .OrderBy(unit => unit.ReferenceKey)
            .ToListAsync();

        Assert.Equal(["ENG", "PLT"], draftUnits.Select(unit => unit.ReferenceKey).ToArray());
        Assert.DoesNotContain(draftUnits, unit => unit.ReferenceKey == "OLD");
        Assert.Equal(
            draftUnits.Single(unit => unit.ReferenceKey == "ENG").Id,
            draftUnits.Single(unit => unit.ReferenceKey == "PLT").ParentId);
    }
}
