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
    public void PlatformAdmin_RemainsReadOnlyTenantViewer()
    {
        var user = CreatePrincipal(roles: [PlatformRole.PlatformAdmin]);

        Assert.True(_service.CanViewOverview(user));
        Assert.True(_service.CanViewTenantEmployees(user));
        Assert.False(_service.CanManageEmployees(user));
        Assert.Equal(PermissionScopes.Tenant, _service.GetEmployeeViewScope(user));
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
