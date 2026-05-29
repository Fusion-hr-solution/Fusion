using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.SharedKernel.Auth;
using System.Security.Claims;

namespace EY.HRPlatform.CoreHR.Features.Security;

public interface ICoreAccessPolicyService
{
    bool CanViewOverview(ClaimsPrincipal user);
    bool CanViewSetup(ClaimsPrincipal user);
    bool CanManageSetup(ClaimsPrincipal user);
    bool CanPublishStructure(ClaimsPrincipal user);
    bool CanViewStructure(ClaimsPrincipal user);
    bool CanManageStructure(ClaimsPrincipal user);
    bool CanViewSettings(ClaimsPrincipal user);
    bool CanManageSettings(ClaimsPrincipal user);
    bool CanViewOrgChart(ClaimsPrincipal user);
    bool CanViewAccess(ClaimsPrincipal user);
    bool CanManageAccess(ClaimsPrincipal user);
    bool CanViewTenantEmployees(ClaimsPrincipal user);
    bool CanManageEmployees(ClaimsPrincipal user);
    bool CanImportEmployees(ClaimsPrincipal user);
    bool CanManageReporting(ClaimsPrincipal user);
    bool CanViewOwnProfile(ClaimsPrincipal user);
    bool CanUpdateOwnProfile(ClaimsPrincipal user);
    bool CanViewTeam(ClaimsPrincipal user);
    EmployeeReadAudience GetEmployeeReadAudience(ClaimsPrincipal user);
    string? GetEmployeeViewScope(ClaimsPrincipal user);
}

public sealed class CoreAccessPolicyService : ICoreAccessPolicyService
{
    public bool CanViewOverview(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.OverviewView, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanViewSetup(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.SetupView, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.SetupManage, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.StructureView, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.StructureManage, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.StructurePublish, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageSetup(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.SetupManage, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.StructureManage, PermissionScopes.Tenant);

    public bool CanPublishStructure(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.StructurePublish, PermissionScopes.Tenant);

    public bool CanViewStructure(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.StructureView, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.StructureManage, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.StructurePublish, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageStructure(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.StructureManage, PermissionScopes.Tenant);

    public bool CanViewSettings(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.SettingsView, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.SettingsManage, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.AccessProfilesManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageSettings(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.SettingsManage, PermissionScopes.Tenant);

    public bool CanViewOrgChart(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.OrgChartView, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanViewAccess(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.AccessView, PermissionScopes.Tenant)
            || user.HasCorePermission(CorePermissions.AccessManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageAccess(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.AccessManage, PermissionScopes.Tenant);

    public bool CanViewTenantEmployees(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageEmployees(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.EmployeeManage, PermissionScopes.Tenant);

    public bool CanImportEmployees(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.EmployeeImport, PermissionScopes.Tenant);

    public bool CanManageReporting(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.ReportingManage, PermissionScopes.Tenant);

    public bool CanViewOwnProfile(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.ProfileSelfView, PermissionScopes.Self)
            || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.Self)
            || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.DirectReports)
            || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.Tenant);

    public bool CanUpdateOwnProfile(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self);

    public bool CanViewTeam(ClaimsPrincipal user)
        => user.HasCorePermission(CorePermissions.TeamView, PermissionScopes.DirectReports)
            || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.DirectReports)
            || user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.Tenant);

    public EmployeeReadAudience GetEmployeeReadAudience(ClaimsPrincipal user)
    {
        var scope = GetEmployeeViewScope(user);
        return scope switch
        {
            PermissionScopes.Tenant => EmployeeReadAudience.HrAdmin,
            PermissionScopes.DirectReports => EmployeeReadAudience.Manager,
            _ => EmployeeReadAudience.Employee,
        };
    }

    public string? GetEmployeeViewScope(ClaimsPrincipal user)
    {
        if (CanViewTenantEmployees(user))
        {
            return PermissionScopes.Tenant;
        }

        if (user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.DirectReports)
            || user.HasCorePermission(CorePermissions.TeamView, PermissionScopes.DirectReports)
            )
        {
            return PermissionScopes.DirectReports;
        }

        if (user.HasCorePermission(CorePermissions.EmployeeView, PermissionScopes.Self)
            || user.HasCorePermission(CorePermissions.ProfileSelfView, PermissionScopes.Self))
        {
            return PermissionScopes.Self;
        }

        return null;
    }
}
