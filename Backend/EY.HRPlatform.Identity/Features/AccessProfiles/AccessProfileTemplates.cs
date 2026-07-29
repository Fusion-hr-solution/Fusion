using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Features.AccessProfiles;

public sealed record SeededAccessProfileTemplate(
    string InternalKey,
    string Name,
    string Description,
    IReadOnlyList<EffectivePermissionGrant> Grants,
    bool IsSystemProtected = true);

public static class AccessProfileTemplates
{
    public static readonly SeededAccessProfileTemplate Employee = new(
        "employee",
        "Employee",
        "Access to own profile and self-service details.",
        [
            new(CorePermissions.ProfileSelfView, PermissionScopes.Self),
            new(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
            new(CorePermissions.EmployeeView, PermissionScopes.Self),
        ]);

    public static readonly SeededAccessProfileTemplate Manager = new(
        "manager",
        "Manager",
        "Access to own profile and direct team.",
        [
            new(CorePermissions.ProfileSelfView, PermissionScopes.Self),
            new(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
            new(CorePermissions.EmployeeView, PermissionScopes.DirectReports),
            new(CorePermissions.TeamView, PermissionScopes.DirectReports),
        ]);

    public static readonly SeededAccessProfileTemplate HrAdmin = new(
        "hr-admin",
        "HR Admin",
        "Manages workforce records, reporting lines, imports, and account activation.",
        [
            new(CorePermissions.OverviewView, PermissionScopes.Tenant),
            new(CorePermissions.SetupView, PermissionScopes.Tenant),
            new(CorePermissions.StructureView, PermissionScopes.Tenant),
            new(CorePermissions.EmployeeView, PermissionScopes.Tenant),
            new(CorePermissions.EmployeeManage, PermissionScopes.Tenant),
            new(CorePermissions.EmployeeImport, PermissionScopes.Tenant),
            new(CorePermissions.ReportingManage, PermissionScopes.Tenant),
            new(CorePermissions.OrgChartView, PermissionScopes.Tenant),
            new(CorePermissions.AccessView, PermissionScopes.Tenant),
            new(CorePermissions.AccessManage, PermissionScopes.Tenant),
            new(CorePermissions.AccessAssignmentsView, PermissionScopes.Tenant),
            new(CorePermissions.AccessAssignmentsManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsPeopleDataView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsStructureView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsProvisioningView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsGovernanceView, PermissionScopes.Tenant),
        ]);

    public static readonly SeededAccessProfileTemplate OrgAdmin = new(
        "org-admin",
        "Org Admin",
        "Manages tenant setup, structure, settings, access profiles, and Core administration.",
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
            new(CorePermissions.AccessAssignmentsView, PermissionScopes.Tenant),
            new(CorePermissions.AccessAssignmentsManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsOrganizationView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsOrganizationManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsPeopleDataView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsPeopleDataManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsStructureView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsStructureManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsProvisioningView, PermissionScopes.Tenant),
            new(CorePermissions.SettingsProvisioningManage, PermissionScopes.Tenant),
            new(CorePermissions.SettingsGovernanceView, PermissionScopes.Tenant),
            new(CorePermissions.AccessProfilesView, PermissionScopes.Tenant),
            new(CorePermissions.AccessProfilesManageV2, PermissionScopes.Tenant),
        ]);

    public static IReadOnlyList<SeededAccessProfileTemplate> All => [Employee, Manager, HrAdmin, OrgAdmin];

    public static SeededAccessProfileTemplate? GetByInternalKey(string internalKey)
        => All.FirstOrDefault(t =>
            string.Equals(t.InternalKey, internalKey, StringComparison.Ordinal));

    private static string PlatformRoleToInternalKey(string role) => role switch
    {
        PlatformRole.HRAdmin => "hr-admin",
        PlatformRole.OrgAdmin => "org-admin",
        _ => role.ToLowerInvariant()
    };

    public static IReadOnlyList<EffectivePermissionGrant> BuildLegacyFallbackGrants(IEnumerable<string> roles)
    {
        var effective = new Dictionary<string, EffectivePermissionGrant>(StringComparer.Ordinal);

        foreach (var role in roles)
        {
            var internalKey = PlatformRoleToInternalKey(role);
            var template = All.FirstOrDefault(candidate =>
                string.Equals(candidate.Name, role, StringComparison.Ordinal)
                || string.Equals(candidate.InternalKey, role, StringComparison.Ordinal)
                || string.Equals(candidate.InternalKey, internalKey, StringComparison.Ordinal));
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

    /// <summary>
    /// Maps legacy/old profile names to their target internal key for migration.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> LegacyNameMapping =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["HRAdmin"] = "hr-admin",
            ["HR Admin"] = "hr-admin",
            ["Core Admin"] = "org-admin",
            ["Core Administrator"] = "org-admin",
            ["Organization Administrator"] = "org-admin",
            ["Org Admin"] = "org-admin",
            ["Access Admin"] = "hr-admin",
            ["Access Manager"] = "hr-admin",
            ["Access Administrator"] = "hr-admin",
        };

    /// <summary>
    /// Old legacy names that should be removed if system-seeded with no assignments.
    /// </summary>
    public static readonly IReadOnlySet<string> ObsoleteLegacyNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "HRAdmin",
        "Core Admin",
        "Core Administrator",
        "Organization Administrator",
        "Access Admin",
        "Access Manager",
        "Access Administrator",
    };
}

