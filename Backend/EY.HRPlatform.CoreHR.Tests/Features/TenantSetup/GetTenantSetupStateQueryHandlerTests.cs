using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetTenantSetupState;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSetup;

public class GetTenantSetupStateQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid ActorUserId = Guid.NewGuid();

    [Fact]
    public async Task Handle_WithNoSetupState_ReturnsNotStartedDefaults()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new GetTenantSetupStateQueryHandler(context);

        var result = await handler.Handle(new GetTenantSetupStateQuery(), CancellationToken.None);

        Assert.Equal("notStarted", result.CurrentPhase);
        Assert.Equal(0, result.CurrentStep);
        Assert.True(result.CanStartSetup);
        Assert.False(result.CanResumeSetup);
        Assert.Null(result.ActivatedAt);
    }

    [Fact]
    public async Task Handle_WithActivatedSetupState_ReturnsActivatedProgress()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetTenantSetupStateQueryHandler(context);

        var result = await handler.Handle(new GetTenantSetupStateQuery(), CancellationToken.None);

        Assert.Equal("activated", result.CurrentPhase);
        Assert.Equal(1, result.CurrentStep);
        Assert.False(result.CanStartSetup);
        Assert.True(result.CanResumeSetup);
        Assert.NotNull(result.ActivatedAt);
        Assert.Contains("activated", result.CompletedSteps);
    }

    [Fact]
    public async Task Handle_WithApprovedSetupState_ReturnsApprovalMetadataAndActivities()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", true);

            seedContext.TenantSetupStates.Add(state);
            seedContext.TenantSetupActivities.Add(
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Approved,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    true));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetTenantSetupStateQueryHandler(context);

        var result = await handler.Handle(new GetTenantSetupStateQuery(), CancellationToken.None);

        Assert.Equal("structurallyGoverned", result.CurrentPhase);
        Assert.Equal("Jordan Approver", result.ApprovedByFullName);
        Assert.Equal("HRAdmin", result.ApprovedByRole);
        Assert.True(result.IsApprovedInPlatformAssistMode);
        Assert.Single(result.RecentActivities);
        Assert.Equal("approved", result.RecentActivities[0].ActivityType);
        Assert.Equal(ActorUserId, result.RecentActivities[0].ActorUserId);
    }

    [Fact]
    public async Task Handle_WithPublishedSetupState_TreatsSetupAsCompleteForUiCompatibility()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", false);
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
                    false),
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Published,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    false));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetTenantSetupStateQueryHandler(context);

        var result = await handler.Handle(new GetTenantSetupStateQuery(), CancellationToken.None);

        Assert.Equal("structurallyPublished", result.CurrentPhase);
        Assert.Equal(4, result.CurrentStep);
        Assert.Equal("Setup is complete", result.NextAction);
        Assert.False(result.CanResumeSetup);
        Assert.NotNull(result.StructurallyPublishedAt);
        Assert.Null(result.OperationalAt);
        Assert.Contains("operational", result.CompletedSteps);
        Assert.Empty(result.PendingSteps);
    }

    [Fact]
    public async Task Handle_WithOperationalSetupState_ReturnsFinalProgressAndLifecycleTimestamps()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(ActorUserId, "Jordan Approver", "HRAdmin", false);
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
                    false),
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Published,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    false),
                TenantSetupActivity.Create(
                    TenantId,
                    state.Id,
                    TenantSetupActivityType.Completed,
                    ActorUserId,
                    "Jordan Approver",
                    "HRAdmin",
                    false));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetTenantSetupStateQueryHandler(context);

        var result = await handler.Handle(new GetTenantSetupStateQuery(), CancellationToken.None);

        Assert.Equal("operational", result.CurrentPhase);
        Assert.Equal(4, result.CurrentStep);
        Assert.False(result.CanResumeSetup);
        Assert.NotNull(result.StructurallyPublishedAt);
        Assert.NotNull(result.OperationalAt);
        Assert.Equal(3, result.RecentActivities.Count);
        Assert.Contains(result.RecentActivities, activity => activity.ActivityType == "published");
        Assert.Contains(result.RecentActivities, activity => activity.ActivityType == "completed");
    }
}