using System.Collections.ObjectModel;

namespace EY.HRPlatform.SharedKernel.Auth;

public static class PermissionScopes
{
    public const string None = "None";
    public const string Self = "Self";
    public const string DirectReports = "DirectReports";
    public const string OrgUnit = "OrgUnit";
    public const string Tenant = "Tenant";
    public const string Module = "Module";
    public const string Platform = "Platform";

    public static readonly ReadOnlyCollection<string> All =
        Array.AsReadOnly([None, Self, DirectReports, OrgUnit, Tenant, Module, Platform]);

    public static bool IsValid(string scope)
        => All.Contains(scope, StringComparer.Ordinal);

    public static int GetRank(string scope)
        => scope switch
        {
            Self => 1,
            DirectReports => 2,
            OrgUnit => 2,
            Tenant => 3,
            Module => 3,
            Platform => 4,
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

    public const string SettingsOrganizationView = "settings.organization.view";
    public const string SettingsOrganizationManage = "settings.organization.manage";
    public const string SettingsPeopleDataView = "settings.peopleData.view";
    public const string SettingsPeopleDataManage = "settings.peopleData.manage";
    public const string SettingsStructureView = "settings.structure.view";
    public const string SettingsStructureManage = "settings.structure.manage";
    public const string SettingsProvisioningView = "settings.provisioning.view";
    public const string SettingsProvisioningManage = "settings.provisioning.manage";
    public const string SettingsGovernanceView = "settings.governance.view";
    public const string AccessProfilesView = "access.profiles.view";
    public const string AccessProfilesManageV2 = "access.profiles.manage";
    public const string AccessAssignmentsView = "access.assignments.view";
    public const string AccessAssignmentsManage = "access.assignments.manage";

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
            SettingsOrganizationView,
            SettingsOrganizationManage,
            SettingsPeopleDataView,
            SettingsPeopleDataManage,
            SettingsStructureView,
            SettingsStructureManage,
            SettingsProvisioningView,
            SettingsProvisioningManage,
            SettingsGovernanceView,
            AccessProfilesView,
            AccessProfilesManageV2,
            AccessAssignmentsView,
            AccessAssignmentsManage,
            SettingsView,
            SettingsManage,
            AccessProfilesManage,
            ProfileSelfView,
            ProfileSelfUpdate,
            TeamView,
        ]);
}

public static class PerformancePermissions
{
    public const string CycleView = "performance.cycle.view";
    public const string CycleManage = "performance.cycle.manage";
    public const string CyclePublish = "performance.cycle.publish";
    public const string ObjectiveSelfManage = "performance.objective.self.manage";
    public const string ObjectiveTeamManage = "performance.objective.team.manage";
    public const string RetentionManage = "performance.retention.manage";
    public const string AuditView = "performance.audit.view";
    public const string ConfidentialIdentityView = "performance.feedback.identity.view";

    // Strategic objective permissions (Plan 03-02, D-05: deny-by-default, never auto-granted by position)
    public const string StrategicView = "performance.strategic.view";
    public const string StrategicManage = "performance.strategic.manage";
    public const string StrategicPublish = "performance.strategic.publish";

    // Progress and team-approval permissions (consumed by Plans 03-03 / 03-04)
    public const string ObjectiveProgressCorrect = "performance.objective.progress.correct";
    public const string ObjectiveTeamApprove = "performance.objective.team.approve";

    // Team-progress visibility for effective reviewers (distinct from plan approval).
    public const string ObjectiveProgressTeamView = "performance.objective.progress.team.view";

    // Check-ins and follow-up (performance record step 2): reviewer conducts, employee views own.
    public const string CheckInConduct = "performance.checkin.conduct";
    public const string CheckInSelfView = "performance.checkin.self.view";

    // Objective planning configuration permissions.
    public const string ObjectivePolicyView = "performance.objective.policy.view";
    public const string ObjectivePolicyManage = "performance.objective.policy.manage";

    // Evaluation configuration, governed round operations, and assignment work-entry doors.
    public const string EvaluationManage = "performance.evaluation.manage";
    public const string EvaluationOperate = "performance.evaluation.operate";
    public const string EvaluationSelfView = "performance.evaluation.self.view";
    public const string EvaluationTeamView = "performance.evaluation.team.view";

    // Skills catalogue, proficiency scales, and expectation sets configuration.
    public const string SkillsManage = "performance.skills.manage";

    public static readonly ReadOnlyCollection<string> All =
        Array.AsReadOnly([
            CycleView,
            CycleManage,
            CyclePublish,
            ObjectiveSelfManage,
            ObjectiveTeamManage,
            RetentionManage,
            AuditView,
            ConfidentialIdentityView,
            StrategicView,
            StrategicManage,
            StrategicPublish,
            ObjectiveProgressCorrect,
            ObjectiveTeamApprove,
            ObjectiveProgressTeamView,
            CheckInConduct,
            CheckInSelfView,
            ObjectivePolicyView,
            ObjectivePolicyManage,
            EvaluationManage,
            EvaluationOperate,
            EvaluationSelfView,
            EvaluationTeamView,
            SkillsManage,
        ]);
}

public static class ModuleSettingsPermissions
{
    public const string LearningView = "settings.modules.view:learning";
    public const string LearningManage = "settings.modules.manage:learning";
    public const string InterviewView = "settings.modules.view:interview";
    public const string InterviewManage = "settings.modules.manage:interview";

    public static readonly ReadOnlyCollection<string> All =
        Array.AsReadOnly([
            LearningView,
            LearningManage,
            InterviewView,
            InterviewManage,
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
            new(CorePermissions.SettingsOrganizationView, "View organization settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsOrganizationManage, "Manage organization settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsPeopleDataView, "View people data settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsPeopleDataManage, "Manage people data settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsStructureView, "View structure settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsStructureManage, "Manage structure settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsProvisioningView, "View provisioning settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsProvisioningManage, "Manage provisioning settings", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsGovernanceView, "View governance and audit", "Settings", [PermissionScopes.Tenant]),
            new(CorePermissions.AccessProfilesView, "View access profiles", "Access profiles", [PermissionScopes.Tenant]),
            new(CorePermissions.AccessProfilesManageV2, "Manage access profiles", "Access profiles", [PermissionScopes.Tenant]),
            new(CorePermissions.AccessAssignmentsView, "View access assignments", "Access", [PermissionScopes.Tenant]),
            new(CorePermissions.AccessAssignmentsManage, "Manage access assignments", "Access", [PermissionScopes.Tenant]),
            new(CorePermissions.SettingsView, "View all Core settings (legacy)", "Settings", [PermissionScopes.Tenant], "Compatibility grant. Prefer section-specific settings permissions."),
            new(CorePermissions.SettingsManage, "Manage all Core settings (legacy)", "Settings", [PermissionScopes.Tenant], "Compatibility grant. Prefer section-specific settings permissions."),
            new(CorePermissions.AccessProfilesManage, "Manage access profiles (legacy)", "Access profiles", [PermissionScopes.Tenant], "Compatibility grant. Prefer access.profiles.manage."),
            new(CorePermissions.ProfileSelfView, "View own profile", "Self & Team", [PermissionScopes.Self]),
            new(CorePermissions.ProfileSelfUpdate, "Update own profile", "Self & Team", [PermissionScopes.Self]),
            new(CorePermissions.TeamView, "View direct team", "Self & Team", [PermissionScopes.DirectReports]),
            new(ModuleSettingsPermissions.LearningView, "View Learning module settings", "Module settings", [PermissionScopes.Module]),
            new(ModuleSettingsPermissions.LearningManage, "Manage Learning module settings", "Module settings", [PermissionScopes.Module]),
            new(ModuleSettingsPermissions.InterviewView, "View Interview module settings", "Module settings", [PermissionScopes.Module]),
            new(ModuleSettingsPermissions.InterviewManage, "Manage Interview module settings", "Module settings", [PermissionScopes.Module]),
            new(PerformancePermissions.CycleView, "View performance cycles", "Performance", [PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant], "Controls access to performance cycles and their participation."),
            new(PerformancePermissions.CycleManage, "Manage performance cycles", "Performance", [PermissionScopes.OrgUnit, PermissionScopes.Tenant], "Create and edit draft cycles and their population."),
            new(PerformancePermissions.CyclePublish, "Operate performance cycles", "Performance", [PermissionScopes.OrgUnit, PermissionScopes.Tenant], "Publish, activate, and close cycles (governance-gated transitions)."),
            new(PerformancePermissions.ObjectiveSelfManage, "Manage own objectives", "Performance", [PermissionScopes.Self]),
            new(PerformancePermissions.ObjectiveTeamManage, "Manage team objectives", "Performance", [PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant]),
            new(PerformancePermissions.RetentionManage, "Manage performance retention", "Performance", [PermissionScopes.Tenant]),
            new(PerformancePermissions.AuditView, "View performance audit", "Performance", [PermissionScopes.OrgUnit, PermissionScopes.Tenant]),
            new(PerformancePermissions.ConfidentialIdentityView, "View confidential feedback identities", "Performance", [PermissionScopes.Tenant]),

            // Strategic objective permissions (D-05: deny-by-default, never auto-granted by position)
            new(PerformancePermissions.StrategicView, "View strategic objectives", "Performance", [PermissionScopes.Tenant]),
            new(PerformancePermissions.StrategicManage, "Manage strategic objectives", "Performance", [PermissionScopes.Tenant]),
            new(PerformancePermissions.StrategicPublish, "Publish strategic objectives", "Performance", [PermissionScopes.Tenant], "Explicit deny-by-default publish grant; never auto-granted by top-management position."),

            // Progress correction and employee objective plan approval permissions
            new(PerformancePermissions.ObjectiveProgressCorrect, "Correct objective progress (manager override)", "Performance", [PermissionScopes.Tenant]),
            new(PerformancePermissions.ObjectiveTeamApprove, "Approve employee objective plans", "Performance", [PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant]),
            new(PerformancePermissions.ObjectiveProgressTeamView, "View team objective progress", "Performance", [PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant]),

            // Check-in and follow-up permissions (performance record step 2).
            new(PerformancePermissions.CheckInConduct, "Conduct performance check-ins", "Performance", [PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant], "Plan, reschedule, cancel, and complete check-ins for participants you review; effective-reviewer scope is enforced per participant."),
            new(PerformancePermissions.CheckInSelfView, "View own check-ins", "Performance", [PermissionScopes.Self]),

            // Objective planning configuration permissions.
            new(PerformancePermissions.ObjectivePolicyView, "View objective planning configuration", "Performance", [PermissionScopes.Tenant]),
            new(PerformancePermissions.ObjectivePolicyManage, "Manage objective planning configuration", "Performance", [PermissionScopes.Tenant]),

            // Evaluation configuration and work-entry permissions.
            new(PerformancePermissions.EvaluationManage, "Manage evaluation configuration and rounds", "Performance", [PermissionScopes.Tenant], "Create and maintain rating scales, templates, and draft evaluation rounds."),
            new(PerformancePermissions.EvaluationOperate, "Operate evaluation rounds", "Performance", [PermissionScopes.Tenant], "Launch rounds and extend deadlines through audited governance transitions."),
            new(PerformancePermissions.EvaluationSelfView, "View own evaluations", "Performance", [PermissionScopes.Self], "Access evaluation assignments where the signed-in employee is the participant."),
            new(PerformancePermissions.EvaluationTeamView, "View team evaluations", "Performance", [PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant], "Access manager assignments only where the signed-in employee is the frozen effective reviewer."),

            // Skills catalogue configuration.
            new(PerformancePermissions.SkillsManage, "Manage skills configuration", "Performance", [PermissionScopes.Tenant], "Create and maintain the skills catalogue, proficiency scales, and expectation sets."),
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
