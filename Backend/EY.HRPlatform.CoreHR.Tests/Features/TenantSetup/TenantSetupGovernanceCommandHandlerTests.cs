using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ApproveTenantStructure;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ReopenTenantStructure;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSetup;

public class TenantSetupGovernanceCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid ApproverId = Guid.NewGuid();
    private static readonly Guid ReopenerId = Guid.NewGuid();
    private const string SettingsJson = """{"orgUnitTypes":["Department","Team"]}""";

    [Fact]
    public async Task Handle_WithReadyDraft_ApprovesSetupAndRecordsActivity()
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
            await seedContext.SaveChangesAsync();
            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new ApproveTenantStructureCommandHandler(context);

        var result = await handler.Handle(
            new ApproveTenantStructureCommand(
                expectedVersion,
                ApproverId,
                "Jordan Approver",
                "HRAdmin",
                false),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("structurallyGoverned", result.Value.CurrentPhase);
        Assert.NotNull(result.Value.ApprovedAt);
        Assert.Equal(ApproverId, result.Value.ApprovedByUserId);
        Assert.Equal("Jordan Approver", result.Value.ApprovedByFullName);
        Assert.Equal("HRAdmin", result.Value.ApprovedByRole);
        Assert.False(result.Value.IsApprovedInPlatformAssistMode);
        Assert.Single(result.Value.RecentActivities);
        Assert.Equal("approved", result.Value.RecentActivities[0].ActivityType);

        var savedState = await context.TenantSetupStates.AsNoTracking().FirstAsync();
        Assert.Equal(TenantSetupPhase.StructurallyGoverned, savedState.CurrentPhase);

        var savedActivity = await context.TenantSetupActivities.AsNoTracking().SingleAsync();
        Assert.Equal(TenantSetupActivityType.Approved, savedActivity.ActivityType);
        Assert.Equal(ApproverId, savedActivity.ActorUserId);
    }

    [Fact]
    public async Task Handle_WithApprovedDraft_ReopensSetupAndRecordsActivity()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ApproverId, "Jordan Approver", "HRAdmin", true);

            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSetupActivities.Add(
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Approved,
                    ApproverId,
                    "Jordan Approver",
                    "HRAdmin",
                    true));
            await seedContext.SaveChangesAsync();
            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new ReopenTenantStructureCommandHandler(context);

        var result = await handler.Handle(
            new ReopenTenantStructureCommand(
                expectedVersion,
                ReopenerId,
                "Alex Reviewer",
                "PlatformAdmin",
                true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("activated", result.Value.CurrentPhase);
        Assert.Null(result.Value.ApprovedAt);
        Assert.Null(result.Value.ApprovedByUserId);
        Assert.False(result.Value.IsApprovedInPlatformAssistMode);
        Assert.Equal(2, result.Value.RecentActivities.Count);
        Assert.Equal("reopened", result.Value.RecentActivities[0].ActivityType);
        Assert.Equal("approved", result.Value.RecentActivities[1].ActivityType);

        var savedState = await context.TenantSetupStates.AsNoTracking().FirstAsync();
        Assert.Equal(TenantSetupPhase.Activated, savedState.CurrentPhase);
        Assert.Null(savedState.ApprovedAt);

        var activities = await context.TenantSetupActivities
            .AsNoTracking()
            .OrderBy(activity => activity.CreatedAt)
            .ToListAsync();

        Assert.Equal(2, activities.Count);
        Assert.Equal(TenantSetupActivityType.Approved, activities[0].ActivityType);
        Assert.Equal(TenantSetupActivityType.Reopened, activities[1].ActivityType);
    }

    [Fact]
    public async Task Handle_WithBlockingDraftIssues_ThrowsInvalidTenantSetupStateException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        uint expectedVersion;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            await seedContext.SaveChangesAsync();
            expectedVersion = state.Version;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new ApproveTenantStructureCommandHandler(context);

        var ex = await Assert.ThrowsAsync<InvalidTenantSetupStateException>(
            () => handler.Handle(
                new ApproveTenantStructureCommand(
                    expectedVersion,
                    ApproverId,
                    "Jordan Approver",
                    "HRAdmin",
                    false),
                CancellationToken.None));

        Assert.Contains("remaining structure issues", ex.Message, StringComparison.OrdinalIgnoreCase);
    }
}