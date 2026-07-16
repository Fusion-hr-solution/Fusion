using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests.Features.Security;

public class PerformanceAccessPolicyServiceTests
{
    private readonly PerformanceAccessPolicyService _policy = new();

    [Fact]
    public void Anonymous_IsDeniedEverything()
    {
        var user = ClaimsPrincipalBuilder.Anonymous();

        Assert.False(_policy.CanViewCycles(user));
        Assert.False(_policy.CanManageCycles(user));
        Assert.False(_policy.CanOperateCycles(user));
        Assert.False(_policy.CanViewObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManageObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManagePlatformDefaults(user));
        Assert.False(_policy.CanActOnOwnedException(user));
        Assert.False(_policy.CanOverrideException(user));
        Assert.False(_policy.CanViewExceptionAudit(user));
    }

    [Fact]
    public void CycleViewGrant_AllowsViewOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleView, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.False(_policy.CanManageCycles(user));
        Assert.False(_policy.CanOperateCycles(user));
    }

    [Fact]
    public void CycleManageGrant_AllowsManageAndView()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.True(_policy.CanManageCycles(user));
        Assert.False(_policy.CanOperateCycles(user));
    }

    [Fact]
    public void CyclePublishGrant_AllowsOperate()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CyclePublish, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanOperateCycles(user));
        Assert.True(_policy.CanViewCycles(user));
    }

    [Fact]
    public void PlatformAdmin_IsAllowedCycleOperations_ButNotTenantPlanningConfiguration()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithRole(PlatformRole.PlatformAdmin)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.True(_policy.CanManageCycles(user));
        Assert.True(_policy.CanOperateCycles(user));
        Assert.True(_policy.CanActOnOwnedException(user));
        Assert.True(_policy.CanOverrideException(user));
        Assert.True(_policy.CanViewExceptionAudit(user));

        Assert.False(_policy.CanViewObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManageObjectivePlanningConfiguration(user));
    }

    [Fact]
    public void ExceptionActionGrant_AllowsOwnerActionOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ExceptionAction, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanActOnOwnedException(user));
        Assert.False(_policy.CanOverrideException(user));
        Assert.False(_policy.CanViewExceptionAudit(user));
    }

    // ─── P1.1 configuration checks ───────────────────────────────────────────

    [Fact]
    public void Anonymous_IsDeniedConfigurationChecks()
    {
        var user = ClaimsPrincipalBuilder.Anonymous();

        Assert.False(_policy.CanViewObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManageObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManagePlatformDefaults(user));
    }

    [Fact]
    public void ObjectivePlanningConfigurationViewGrant_AllowsViewOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectivePolicyView, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManageObjectivePlanningConfiguration(user));
    }

    [Fact]
    public void ObjectivePlanningConfigurationManageGrant_AllowsViewAndManage()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewObjectivePlanningConfiguration(user));
        Assert.True(_policy.CanManageObjectivePlanningConfiguration(user));
    }

    [Fact]
    public void PlatformAdminRole_AllowsPlatformConfigurationOnly_NotTenantConfigurationChecks()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithRole(PlatformRole.PlatformAdmin)
            .Build();

        Assert.True(_policy.CanManagePlatformDefaults(user));
        // PlatformAdmin does not implicitly get tenant-scoped configuration — deny-by-default
        Assert.False(_policy.CanViewObjectivePlanningConfiguration(user));
        Assert.False(_policy.CanManageObjectivePlanningConfiguration(user));
    }

    [Fact]
    public void TenantConfigurationManage_DoesNotGrantPlatformConfiguration()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant)
            .Build();

        Assert.False(_policy.CanManagePlatformDefaults(user));
    }

    // ─── P1.3 team objectives + cascade coverage ─────────────────────────────

    [Fact]
    public void Anonymous_IsDeniedTeamObjectiveAndCoverageChecks()
    {
        var user = ClaimsPrincipalBuilder.Anonymous();

        Assert.False(_policy.CanManageTeamObjectives(user));
        Assert.False(_policy.CanViewCascadeCoverage(user));
    }

    [Fact]
    public void TeamObjectiveManageGrant_AnyCatalogScope_AllowsManageOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectiveTeamManage, PermissionScopes.DirectReports)
            .Build();

        Assert.True(_policy.CanManageTeamObjectives(user));
        Assert.False(_policy.CanViewCascadeCoverage(user));
        Assert.False(_policy.CanViewCycles(user));
    }

    [Fact]
    public void PlatformAdmin_GetsNoTeamObjectiveAuthoringBypass()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithRole(PlatformRole.PlatformAdmin)
            .Build();

        Assert.False(_policy.CanManageTeamObjectives(user));
    }

    [Fact]
    public void StrategicViewGrant_AllowsCoverageWithoutCampaignAdministration()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.StrategicView, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewCascadeCoverage(user));
        Assert.False(_policy.CanManageTeamObjectives(user));
        Assert.False(_policy.CanViewCycles(user));
        Assert.False(_policy.CanManageCycles(user));
    }

    [Fact]
    public void CycleViewGrant_AllowsCoverage()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleView, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewCascadeCoverage(user));
    }
}
