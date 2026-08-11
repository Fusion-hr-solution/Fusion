using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Features.TenantAdministration;

public sealed class TenantAdministratorAuthorityTests
{
    [Fact]
    public void Canonical_administrator_always_has_both_tenant_scoped_Organization_grants()
    {
        var grants = AccessProfileTemplates.BuildTenantAdministrator([]).Grants;

        Assert.Contains(grants, grant => grant.PermissionKey == CorePermissions.OrganizationView
            && grant.Scope == PermissionScopes.Tenant);
        Assert.Contains(grants, grant => grant.PermissionKey == CorePermissions.OrganizationManage
            && grant.Scope == PermissionScopes.Tenant);
    }

    [Fact]
    public void Employee_and_Manager_templates_do_not_receive_Organization_authority()
    {
        Assert.DoesNotContain(AccessProfileTemplates.Employee.Grants,
            grant => grant.PermissionKey is CorePermissions.OrganizationView or CorePermissions.OrganizationManage);
        Assert.DoesNotContain(AccessProfileTemplates.Manager.Grants,
            grant => grant.PermissionKey is CorePermissions.OrganizationView or CorePermissions.OrganizationManage);
    }
}
