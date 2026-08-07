namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Module identifiers used when a module registers the permissions it owns.
/// A module key is the durable contract between an owning module and the
/// composition of the canonical Tenant Administrator authority.
/// </summary>
public static class PermissionModuleKeys
{
    /// <summary>Core HR. Mandatory for every provisioned tenant.</summary>
    public const string CoreHR = "corehr";

    /// <summary>Performance. Entitlement-gated.</summary>
    public const string Performance = "performance";

    /// <summary>Learning module settings. Owned by a parallel module.</summary>
    public const string Learning = "learning";

    /// <summary>Interview module settings. Owned by a parallel module.</summary>
    public const string Interview = "interview";
}

/// <summary>
/// One module's contribution to the platform permission surface.
/// <para>
/// A module contributes its own permission definitions and states the scopes the
/// canonical Tenant Administrator receives for them. Contributions belong with
/// their owning module's shared contract; <see cref="CorePermissionCatalog"/> is
/// not the platform-wide authorization authority and must not grow into one.
/// </para>
/// <para>
/// A contribution is composed into the Tenant Administrator definition only when
/// the tenant holds the corresponding module entitlement, evaluated at seed and
/// re-seed time.
/// </para>
/// </summary>
/// <param name="ModuleKey">Module entitlement this contribution depends on.</param>
/// <param name="Definitions">Permission definitions the module owns.</param>
public sealed record ModulePermissionContribution(
    string ModuleKey,
    IReadOnlyList<CorePermissionDefinition> Definitions);

/// <summary>
/// The registered module permission contributions.
/// <para>
/// Composition is deterministic and declaration-ordered so that seeding the same
/// tenant twice produces the same definition.
/// </para>
/// </summary>
public static class ModulePermissionRegistry
{
    private static readonly ModulePermissionContribution CoreHR = new(
        PermissionModuleKeys.CoreHR,
        CorePermissionCatalog.All
            .Where(definition => !definition.Key.StartsWith("settings.modules.", StringComparison.Ordinal))
            .ToList());

    private static readonly ModulePermissionContribution Learning = new(
        PermissionModuleKeys.Learning,
        [
            CorePermissionCatalog.Get(ModuleSettingsPermissions.LearningView),
            CorePermissionCatalog.Get(ModuleSettingsPermissions.LearningManage),
        ]);

    private static readonly ModulePermissionContribution Interview = new(
        PermissionModuleKeys.Interview,
        [
            CorePermissionCatalog.Get(ModuleSettingsPermissions.InterviewView),
            CorePermissionCatalog.Get(ModuleSettingsPermissions.InterviewManage),
        ]);

    /// <summary>
    /// Performance owns no permissions yet. The registration point is declared so
    /// the module adds its own permissions from its own shared contract rather
    /// than by editing the Core catalogue.
    /// </summary>
    private static readonly ModulePermissionContribution Performance = new(
        PermissionModuleKeys.Performance,
        []);

    public static IReadOnlyList<ModulePermissionContribution> All { get; } =
        [CoreHR, Performance, Learning, Interview];

    public static ModulePermissionContribution? ForModule(string moduleKey)
        => All.FirstOrDefault(contribution =>
            string.Equals(contribution.ModuleKey, moduleKey, StringComparison.OrdinalIgnoreCase));
}
