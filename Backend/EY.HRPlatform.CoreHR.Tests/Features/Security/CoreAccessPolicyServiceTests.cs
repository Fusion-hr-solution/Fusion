using System.Security.Claims;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.CoreHR.Tests.Features.Security;

public class CoreAccessPolicyServiceTests
{
    private readonly CoreAccessPolicyService _service = new();

    [Fact]
    public void TenantEmployeeView_GrantsTenantAudience()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.EmployeeView, PermissionScopes.Tenant));

        Assert.True(_service.CanViewTenantEmployees(user));
        Assert.Equal(PermissionScopes.Tenant, _service.GetEmployeeViewScope(user));
        Assert.Equal(EmployeeReadAudience.HrAdmin, _service.GetEmployeeReadAudience(user));
    }

    [Fact]
    public void DirectReportPermissions_GrantTeamAudience()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.TeamView, PermissionScopes.DirectReports));

        Assert.True(_service.CanViewTeam(user));
        Assert.Equal(PermissionScopes.DirectReports, _service.GetEmployeeViewScope(user));
        Assert.Equal(EmployeeReadAudience.Manager, _service.GetEmployeeReadAudience(user));
    }

    [Fact]
    public void SelfProfilePermissions_GrantOwnProfileOnly()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.ProfileSelfView, PermissionScopes.Self),
            (CorePermissions.ProfileSelfUpdate, PermissionScopes.Self));

        Assert.True(_service.CanViewOwnProfile(user));
        Assert.True(_service.CanUpdateOwnProfile(user));
        Assert.Equal(PermissionScopes.Self, _service.GetEmployeeViewScope(user));
        Assert.Equal(EmployeeReadAudience.Employee, _service.GetEmployeeReadAudience(user));
        Assert.False(_service.CanViewTeam(user));
    }

    [Fact]
    public void RoleOnlyManager_NoLongerGetsCoreAccessWithoutPermissionClaims()
    {
        var user = CreatePrincipal(roles: [PlatformRole.Manager]);

        Assert.False(_service.CanViewOwnProfile(user));
        Assert.False(_service.CanViewTeam(user));
        Assert.Null(_service.GetEmployeeViewScope(user));
    }

    [Fact]
    public void Organization_management_is_capability_based_and_not_granted_by_manager_role()
    {
        var manager = CreatePrincipal(roles: [PlatformRole.Manager]);
        var viewer = CreatePrincipal(null, (CorePermissions.OrganizationView, PermissionScopes.Tenant));
        var managerCapability = CreatePrincipal(null, (CorePermissions.OrganizationManage, PermissionScopes.Tenant));

        Assert.False(_service.CanViewOrganization(manager));
        Assert.False(_service.CanManageOrganization(manager));
        Assert.True(_service.CanViewOrganization(viewer));
        Assert.False(_service.CanManageOrganization(viewer));
        Assert.True(_service.CanViewOrganization(managerCapability));
        Assert.True(_service.CanManageOrganization(managerCapability));
    }

    [Fact]
    public void PlatformAdminRoleAlone_GrantsNoCustomerWorkspaceAccess()
    {
        var user = CreatePrincipal(roles: [PlatformRole.PlatformAdmin]);

        Assert.False(_service.CanViewOverview(user));
        Assert.False(_service.CanViewSetup(user));
        Assert.False(_service.CanViewStructure(user));
        Assert.False(_service.CanViewOrgChart(user));
        Assert.False(_service.CanViewAccess(user));
        Assert.False(_service.CanViewTenantEmployees(user));
        Assert.False(_service.CanViewSettings(user));
        Assert.False(_service.CanManageAccess(user));
        Assert.False(_service.CanManageEmployees(user));
        Assert.Null(_service.GetEmployeeViewScope(user));
    }

    [Fact]
    public void AccessViewPermission_GrantsAccessWorkspaceReadOnly()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.AccessView, PermissionScopes.Tenant));

        Assert.True(_service.CanViewAccess(user));
        Assert.False(_service.CanManageAccess(user));
    }

    [Fact]
    public void AccessManagePermission_GrantsAccessWorkspaceManagement()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.AccessManage, PermissionScopes.Tenant));

        Assert.True(_service.CanViewAccess(user));
        Assert.True(_service.CanManageAccess(user));
    }

    [Fact]
    public void AccessProfileManagement_GrantsOnlyAccessPermissionsSettingsSection()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.AccessProfilesManageV2, PermissionScopes.Tenant));

        Assert.True(_service.CanViewSettings(user));
        Assert.True(_service.CanViewAccessProfiles(user));
        Assert.True(_service.CanManageAccessProfiles(user));
        Assert.False(_service.CanManageSettings(user));
        Assert.False(_service.CanViewPeopleDataSettings(user));
    }

    [Fact]
    public void PeopleDataAdmin_GrantsOnlyPeopleDataSettingsSection()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.SettingsPeopleDataManage, PermissionScopes.Tenant));

        Assert.True(_service.CanViewSettings(user));
        Assert.True(_service.CanViewPeopleDataSettings(user));
        Assert.True(_service.CanManagePeopleDataSettings(user));
        Assert.True(_service.CanManageSettings(user));
        Assert.False(_service.CanViewAccessProfiles(user));
        Assert.False(_service.CanViewProvisioningSettings(user));
    }

    [Fact]
    public void GovernanceReader_IsReadOnly()
    {
        var user = CreatePrincipal(
            null,
            (CorePermissions.SettingsGovernanceView, PermissionScopes.Tenant));

        Assert.True(_service.CanViewSettings(user));
        Assert.True(_service.CanViewGovernanceSettings(user));
        Assert.False(_service.CanManageSettings(user));
    }

    private static ClaimsPrincipal CreatePrincipal(
        IEnumerable<string>? roles = null,
        params (string PermissionKey, string Scope)[] grants)
    {
        var claims = new List<Claim>();

        foreach (var role in roles ?? [])
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        foreach (var (permissionKey, scope) in grants)
        {
            claims.Add(new Claim(
                CustomClaimTypes.CorePermission,
                CorePermissionClaimValue.Encode(permissionKey, scope)));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
    }
}
