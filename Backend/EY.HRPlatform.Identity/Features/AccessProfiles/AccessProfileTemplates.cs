using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Features.AccessProfiles;

public sealed record SeededAccessProfileTemplate(
    string Name,
    string Description,
    IReadOnlyList<EffectivePermissionGrant> Grants,
    bool IsSystemProtected = true);

public static class AccessProfileTemplates
{
    public static readonly SeededAccessProfileTemplate HrAdmin = new(
        PlatformRole.HRAdmin,
        "Tenant-wide Core management.",
        [
            new(CorePermissions.OverviewView, PermissionScopes.Tenant),
            new(CorePermissions.SetupView, PermissionScopes.Tenant),
            new(CorePermissions.SetupManage, PermissionScopes.Tenant),
            new(CorePermissions.StructureView, PermissionScopes.Tenant),
            new(CorePermissions.StructureManage, PermissionScopes.Tenant),
            new(CorePermissions.StructurePublish, PermissionScopes.Tenant),
            new(CorePermissions.EmployeeView, PermissionScopes.Tenant),
            new(CorePermissions.EmployeeManage, PermissionScopes.Tenant),
            new(CorePermissions.EmployeeImport, PermissionScopes.Tenant),
            new(CorePermissions.ReportingManage, PermissionScopes.Tenant),
            new(CorePermissions.OrgChartView, PermissionScopes.Tenant),
            new(CorePermissions.AccessView, PermissionScopes.Tenant),
            new(CorePermissions.AccessManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsManage, PermissionScopes.Tenant),
            new(CorePermissions.AccessProfilesManage, PermissionScopes.Tenant),
            new(CorePermissions.ProfileSelfView, PermissionScopes.Self),
            new(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
            new(CorePermissions.TeamView, PermissionScopes.DirectReports),
        ]);

    public static readonly SeededAccessProfileTemplate Manager = new(
        PlatformRole.Manager,
        "Self-service and direct-team visibility.",
        [
            new(CorePermissions.ProfileSelfView, PermissionScopes.Self),
            new(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
            new(CorePermissions.TeamView, PermissionScopes.DirectReports),
            new(CorePermissions.EmployeeView, PermissionScopes.DirectReports),
        ]);

    public static readonly SeededAccessProfileTemplate Employee = new(
        PlatformRole.Employee,
        "Self-service Core access.",
        [
            new(CorePermissions.ProfileSelfView, PermissionScopes.Self),
            new(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
        ]);

    public static IReadOnlyList<SeededAccessProfileTemplate> All => [HrAdmin, Manager, Employee];

    public static IReadOnlyList<EffectivePermissionGrant> BuildLegacyFallbackGrants(IEnumerable<string> roles)
    {
        var effective = new Dictionary<string, EffectivePermissionGrant>(StringComparer.Ordinal);

        foreach (var role in roles)
        {
            var template = All.FirstOrDefault(candidate =>
                string.Equals(candidate.Name, role, StringComparison.Ordinal));
            if (template is null)
            {
                continue;
            }

            foreach (var grant in template.Grants)
            {
                if (!effective.TryGetValue(grant.PermissionKey, out var current))
                {
                    effective[grant.PermissionKey] = grant;
                    continue;
                }

                effective[grant.PermissionKey] =
                    PermissionScopes.GetRank(grant.Scope) > PermissionScopes.GetRank(current.Scope)
                        ? grant
                        : current;
            }
        }

        return effective.Values.ToList();
    }
}
