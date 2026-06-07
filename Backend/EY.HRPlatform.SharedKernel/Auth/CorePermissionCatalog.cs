using System.Collections.ObjectModel;

namespace EY.HRPlatform.SharedKernel.Auth;

public static class PermissionScopes
{
    public const string None = "None";
    public const string Self = "Self";
    public const string DirectReports = "DirectReports";
    public const string Tenant = "Tenant";

    public static readonly ReadOnlyCollection<string> All =
        Array.AsReadOnly([None, Self, DirectReports, Tenant]);

    public static bool IsValid(string scope)
        => All.Contains(scope, StringComparer.Ordinal);

    public static int GetRank(string scope)
        => scope switch
        {
            Self => 1,
            DirectReports => 2,
            Tenant => 3,
            _ => 0,
        };

    public static string Max(string left, string right)
        => GetRank(left) >= GetRank(right) ? left : right;
}

public static class CorePermissions
{
    public const string OverviewView = "core.overview.view";

    public const string SetupView = "core.setup.view";
    public const string SetupManage = "core.setup.manage";
    public const string StructureView = "core.structure.view";
    public const string StructureManage = "core.structure.manage";
    public const string StructurePublish = "core.structure.publish";

    public const string EmployeeView = "core.employee.view";
    public const string EmployeeManage = "core.employee.manage";
    public const string EmployeeImport = "core.employee.import";
    public const string ReportingManage = "core.reporting.manage";

    public const string OrgChartView = "core.orgchart.view";

    public const string AccessView = "core.access.view";
    public const string AccessManage = "core.access.manage";

    public const string SettingsView = "core.settings.view";
    public const string SettingsManage = "core.settings.manage";
    public const string AccessProfilesManage = "core.accessprofiles.manage";

    public const string ProfileSelfView = "core.profile.self.view";
    public const string ProfileSelfUpdate = "core.profile.self.update";
    public const string TeamView = "core.team.view";

    public static readonly ReadOnlyCollection<string> All =
        Array.AsReadOnly([
            OverviewView,
            SetupView,
            SetupManage,
            StructureView,
            StructureManage,
            StructurePublish,
            EmployeeView,
            EmployeeManage,
            EmployeeImport,
            ReportingManage,
            OrgChartView,
            AccessView,
            AccessManage,
            SettingsView,
            SettingsManage,
            AccessProfilesManage,
            ProfileSelfView,
            ProfileSelfUpdate,
            TeamView,
        ]);
}

public sealed record CorePermissionDefinition(
    string Key,
    string Label,
    string Group,
    IReadOnlyList<string> AllowedScopes,
    string? HelperText = null);

public sealed record EffectivePermissionGrant(string PermissionKey, string Scope);

public static class CorePermissionCatalog
{
    private static readonly ReadOnlyCollection<CorePermissionDefinition> Definitions =
        Array.AsReadOnly<CorePermissionDefinition>([
            new(CorePermissions.OverviewView, "View overview", "Workspace", [PermissionScopes.Tenant]),
            new(CorePermissions.SetupView, "View setup", "Setup & Structure", [PermissionScopes.Tenant]),
            new(CorePermissions.SetupManage, "Manage setup", "Setup & Structure", [PermissionScopes.Tenant]),
            new(CorePermissions.StructureView, "View structure", "Setup & Structure", [PermissionScopes.Tenant]),
            new(CorePermissions.StructureManage, "Manage structure", "Setup & Structure", [PermissionScopes.Tenant]),
            new(CorePermissions.StructurePublish, "Publish structure", "Setup & Structure", [PermissionScopes.Tenant]),
            new(CorePermissions.EmployeeView, "View employees", "Employees", [PermissionScopes.Self, PermissionScopes.DirectReports, PermissionScopes.Tenant], "Controls access to employee profiles and roster surfaces."),
            new(CorePermissions.EmployeeManage, "Manage employees", "Employees", [PermissionScopes.Tenant]),
            new(CorePermissions.EmployeeImport, "Import employees", "Employees", [PermissionScopes.Tenant]),
            new(CorePermissions.ReportingManage, "Manage reporting lines", "Employees", [PermissionScopes.Tenant]),
            new(CorePermissions.OrgChartView, "View org chart", "Org Chart", [PermissionScopes.DirectReports, PermissionScopes.Tenant]),
            new(CorePermissions.AccessView, "View access invitations", "Access", [PermissionScopes.Tenant]),
            new(CorePermissions.AccessManage, "Manage access invitations", "Access", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsView, "View Core settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsManage, "Manage Core settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.AccessProfilesManage, "Manage access profiles", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.ProfileSelfView, "View own profile", "Self & Team", [PermissionScopes.Self]),
            new(CorePermissions.ProfileSelfUpdate, "Update own profile", "Self & Team", [PermissionScopes.Self]),
            new(CorePermissions.TeamView, "View direct team", "Self & Team", [PermissionScopes.DirectReports]),
        ]);

    private static readonly IReadOnlyDictionary<string, CorePermissionDefinition> ByKey =
        Definitions.ToDictionary(definition => definition.Key, StringComparer.Ordinal);

    public static IReadOnlyList<CorePermissionDefinition> All => Definitions;

    public static CorePermissionDefinition Get(string key)
        => ByKey.TryGetValue(key, out var definition)
            ? definition
            : throw new InvalidOperationException($"Unknown Core permission '{key}'.");

    public static bool TryGet(string key, out CorePermissionDefinition? definition)
        => ByKey.TryGetValue(key, out definition);

    public static bool IsKnown(string key)
        => ByKey.ContainsKey(key);

    public static bool IsValidScope(string key, string scope)
        => TryGet(key, out var definition)
            && !string.IsNullOrWhiteSpace(scope)
            && definition!.AllowedScopes.Contains(scope, StringComparer.Ordinal);

    public static EffectivePermissionGrant? NormalizeGrant(string permissionKey, string scope)
    {
        if (!IsKnown(permissionKey) || !IsValidScope(permissionKey, scope))
        {
            return null;
        }

        return new EffectivePermissionGrant(permissionKey, scope);
    }
}
