using System.Security.Claims;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSettings;

public class SettingsSectionRegistryTests
{
    private readonly SettingsSectionRegistry _registry = new(new CoreAccessPolicyService());

    [Fact]
    public void GetVisibleSections_WithPeopleDataAdmin_ShowsOnlyOverviewAndPeopleData()
    {
        var user = CreatePrincipal(
            (CorePermissions.SettingsPeopleDataManage, PermissionScopes.Tenant));

        var sectionIds = _registry.GetVisibleSections(user).Select(section => section.Id).ToList();

        Assert.Equal([SettingsSectionIds.Overview, SettingsSectionIds.PeopleData], sectionIds);
    }

    [Fact]
    public void GetVisibleSections_WithAccessProfileAdmin_ShowsOnlyOverviewAndAccessPermissions()
    {
        var user = CreatePrincipal(
            (CorePermissions.AccessProfilesManageV2, PermissionScopes.Tenant));

        var sections = _registry.GetVisibleSections(user);

        Assert.Equal(
            [SettingsSectionIds.Overview, SettingsSectionIds.AccessPermissions],
            sections.Select(section => section.Id).ToList());
        Assert.True(sections.Single(section => section.Id == SettingsSectionIds.AccessPermissions).CanManage);
    }

    [Fact]
    public void GetVisibleSections_WithPlatformAdminRoleOnly_ReturnsNoTenantSettingsSections()
    {
        var user = CreatePrincipal(roles: [PlatformRole.PlatformAdmin]);

        Assert.Empty(_registry.GetVisibleSections(user));
    }

    private static ClaimsPrincipal CreatePrincipal(
        params (string PermissionKey, string Scope)[] grants)
        => CreatePrincipal(null, grants);

    private static ClaimsPrincipal CreatePrincipal(
        IEnumerable<string>? roles = null,
        params (string PermissionKey, string Scope)[] grants)
    {
        var claims = new List<Claim>();
        claims.AddRange((roles ?? []).Select(role => new Claim(ClaimTypes.Role, role)));
        claims.AddRange(grants.Select(grant => new Claim(
            CustomClaimTypes.CorePermission,
            CorePermissionClaimValue.Encode(grant.PermissionKey, grant.Scope))));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
    }
}
