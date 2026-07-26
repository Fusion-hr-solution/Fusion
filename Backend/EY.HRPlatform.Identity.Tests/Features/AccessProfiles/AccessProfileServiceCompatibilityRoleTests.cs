using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Features.AccessProfiles;

public class AccessProfileServiceCompatibilityRoleTests
{
    private readonly AccessProfileService _service = new(null!, null!);

    [Fact]
    public void ResolveCompatibilityRole_FullHrAdminPermissions_ReturnsHrAdmin()
    {
        var role = _service.ResolveCompatibilityRole(AccessProfileTemplates.HrAdmin.Grants);

        Assert.Equal(PlatformRole.HRAdmin, role);
    }

    [Fact]
    public void HrAdminTemplate_IncludesObjectivePlanningConfigurationManagement()
    {
        Assert.Contains(AccessProfileTemplates.HrAdmin.Grants, grant =>
            grant.PermissionKey == PerformancePermissions.ObjectivePolicyManage
            && grant.Scope == PermissionScopes.Tenant);
    }

    [Fact]
    public void OrgAdminTemplate_IncludesObjectivePlanningConfigurationManagement()
    {
        Assert.Contains(AccessProfileTemplates.OrgAdmin.Grants, grant =>
            grant.PermissionKey == PerformancePermissions.ObjectivePolicyManage
            && grant.Scope == PermissionScopes.Tenant);
    }

    [Fact]
    public void ResolveCompatibilityRole_ManagerPermissions_ReturnsManager()
    {
        var role = _service.ResolveCompatibilityRole(AccessProfileTemplates.Manager.Grants);

        Assert.Equal(PlatformRole.Manager, role);
    }

    [Fact]
    public void DemoProfiles_IncludeRoleAppropriateEvaluationPermissions()
    {
        Assert.Contains(AccessProfileTemplates.Employee.Grants, grant =>
            grant.PermissionKey == PerformancePermissions.EvaluationSelfView
            && grant.Scope == PermissionScopes.Self);
        Assert.Contains(AccessProfileTemplates.Manager.Grants, grant =>
            grant.PermissionKey == PerformancePermissions.EvaluationTeamView
            && grant.Scope == PermissionScopes.DirectReports);
        Assert.Contains(AccessProfileTemplates.HrAdmin.Grants, grant =>
            grant.PermissionKey == PerformancePermissions.EvaluationManage
            && grant.Scope == PermissionScopes.Tenant);
        Assert.Contains(AccessProfileTemplates.HrAdmin.Grants, grant =>
            grant.PermissionKey == PerformancePermissions.EvaluationOperate
            && grant.Scope == PermissionScopes.Tenant);
    }

    [Fact]
    public void ResolveCompatibilityRole_NarrowAccessAdminPermissions_DoNotEscalateToHrAdmin()
    {
        var role = _service.ResolveCompatibilityRole([
            new EffectivePermissionGrant(CorePermissions.AccessProfilesManage, PermissionScopes.Tenant),
            new EffectivePermissionGrant(CorePermissions.AccessManage, PermissionScopes.Tenant),
        ]);

        Assert.Equal(PlatformRole.Employee, role);
    }
}
