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

    /// <summary>
    /// The canonical Tenant Administrator definition for one tenant.
    /// <para>
    /// Its grants depend on the tenant's module entitlements, so it is composed per
    /// tenant at seed and re-seed time rather than declared as a static template.
    /// </para>
    /// </summary>
    public static SeededAccessProfileTemplate BuildTenantAdministrator(IEnumerable<string> enabledModuleKeys)
        => new(
            TenantAdministratorAuthority.InternalKey,
            TenantAdministratorAuthority.DisplayName,
            TenantAdministratorAuthority.Description,
            TenantAdministratorAuthority.BuildGrants(enabledModuleKeys));

    /// <summary>
    /// Statically declared seeded profiles. The Tenant Administrator definition is
    /// entitlement-dependent and is composed through
    /// <see cref="BuildTenantAdministrator"/> instead.
    /// </summary>
    public static IReadOnlyList<SeededAccessProfileTemplate> All => [Employee, Manager, HrAdmin, OrgAdmin];

    public static SeededAccessProfileTemplate? GetByInternalKey(string internalKey)
        => All.FirstOrDefault(t =>
            string.Equals(t.InternalKey, internalKey, StringComparison.Ordinal));


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

