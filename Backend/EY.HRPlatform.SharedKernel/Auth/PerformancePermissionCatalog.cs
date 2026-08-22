using System.Collections.ObjectModel;

namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// The Performance module's permission keys. Performance owns this slice; it is
/// contributed to the platform through <see cref="ModulePermissionContribution"/>
/// and resolved alongside every other module's slice by <see cref="PermissionCatalog"/>.
/// <para>
/// These keys reuse the shared <c>core_permission</c> <c>key|scope</c> claim format
/// and the shared <see cref="PermissionScopes"/> ladder. Performance does not create
/// a second role store, claim format, or scope system.
/// </para>
/// </summary>
public static class PerformancePermissions
{
    /// <summary>
    /// Read/enter Performance and Cycle context. Scope sets the breadth of aggregate
    /// (organizational) visibility. <c>Self</c> = enter + own participation only.
    /// </summary>
    public const string CycleView = "performance.cycle.view";

    /// <summary>
    /// Tenant performance administration: settings, cycle create/activate/close,
    /// population, governed corrections, and exceptional plan approval.
    /// </summary>
    public const string CycleManage = "performance.cycle.manage";

    /// <summary>Create and publish company strategic direction for a Cycle.</summary>
    public const string StrategyPublish = "performance.strategy.publish";

    /// <summary>
    /// Employee participation: author/submit own plan, own objective progress, own evidence.
    /// </summary>
    public const string ObjectiveSelfManage = "performance.objective.self.manage";

    public static readonly ReadOnlyCollection<string> All =
        Array.AsReadOnly([CycleView, CycleManage, StrategyPublish, ObjectiveSelfManage]);
}

/// <summary>
/// Performance's permission-definition slice. Kept beside the other module slices in
/// SharedKernel so the platform can compose the canonical Tenant Administrator and so
/// Identity can validate and seed grants — while the definitions remain Performance's
/// contract, contributed (never merged into the Core catalogue).
/// </summary>
public static class PerformancePermissionCatalog
{
    private const string Group = "Performance";

    public static readonly ReadOnlyCollection<CorePermissionDefinition> Definitions =
        Array.AsReadOnly<CorePermissionDefinition>([
            new(
                PerformancePermissions.CycleView,
                "View Performance",
                Group,
                [PermissionScopes.Self, PermissionScopes.DirectReports, PermissionScopes.OrgUnit, PermissionScopes.Tenant],
                "Enter Performance and see Cycle context. Scope sets how wide aggregate visibility is; Self is own participation only."),
            new(
                PerformancePermissions.CycleManage,
                "Administer Performance cycles",
                Group,
                [PermissionScopes.Tenant],
                "Tenant performance administration: settings, cycle create/activate/close, population, and exceptional plan approval."),
            new(
                PerformancePermissions.StrategyPublish,
                "Publish strategic direction",
                Group,
                [PermissionScopes.Tenant],
                "Create and publish company strategic direction. Distinct from administering the cycle process."),
            new(
                PerformancePermissions.ObjectiveSelfManage,
                "Manage own performance plan",
                Group,
                [PermissionScopes.Self],
                "Author and submit your own plan, and update your own objective progress and evidence."),
        ]);
}
