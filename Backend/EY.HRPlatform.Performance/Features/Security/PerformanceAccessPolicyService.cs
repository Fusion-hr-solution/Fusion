using EY.HRPlatform.SharedKernel.Auth;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.Security;

public interface IPerformanceAccessPolicyService
{
    bool CanViewCycles(ClaimsPrincipal user);
    bool CanManageCycles(ClaimsPrincipal user);
    bool CanOperateCycles(ClaimsPrincipal user);

    // Strategic objective access (D-05: deny-by-default; no position auto-grant)
    bool CanViewStrategicObjectives(ClaimsPrincipal user);
    bool CanManageStrategicObjectives(ClaimsPrincipal user);
    bool CanPublishStrategicObjectives(ClaimsPrincipal user);

    // Team objectives (P1.3): capability permission only — frozen-baseline responsibility
    // and ownership are enforced per operation in the handlers.
    bool CanManageTeamObjectives(ClaimsPrincipal user) => false;

    // Cascade coverage read (P1.3): Direction door (strategic view) or HR door (cycle view/manage).
    bool CanViewCascadeCoverage(ClaimsPrincipal user) => false;

    // Feedback identity access (D-07/D-10: exceptional identity resolution)
    bool CanAccessConfidentialFeedbackIdentity(ClaimsPrincipal user);

    // Feedback threshold details (admin/HR only)
    bool CanViewFeedbackThresholdDetails(ClaimsPrincipal user);

    bool CanActOnOwnedException(ClaimsPrincipal user) => false;
    bool CanOverrideException(ClaimsPrincipal user) => false;
    bool CanViewExceptionAudit(ClaimsPrincipal user) => false;

    // Objective planning configuration
    bool CanViewObjectivePlanningConfiguration(ClaimsPrincipal user) => false;
    bool CanManageObjectivePlanningConfiguration(ClaimsPrincipal user) => false;

    // Platform configuration — gated by PlatformRole.PlatformAdmin only (D1)
    bool CanManagePlatformDefaults(ClaimsPrincipal user) => false;
}

/// <summary>
/// Central, deny-by-default authorization checks for the Performance module.
/// Cycle administration is tenant-scoped (HR/Org admins); transitions are gated separately.
/// </summary>
public sealed class PerformanceAccessPolicyService : IPerformanceAccessPolicyService
{
    public bool CanViewCycles(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.CyclePublish, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageCycles(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanOperateCycles(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CyclePublish, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    // ─── Strategic objective permissions (D-05) ───────────────────────────────

    public bool CanViewStrategicObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategicView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.StrategicManage, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.StrategicPublish, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageStrategicObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategicManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanPublishStrategicObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategicPublish, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    // ─── Team objectives + cascade coverage (P1.3) ────────────────────────────

    /// <summary>
    /// Any catalog scope of the team-objective permission qualifies: the effective scope is the
    /// frozen approver baseline, which is stricter than permission scope. No PlatformAdmin bypass —
    /// team objectives are owned business content, not administration.
    /// </summary>
    public bool CanManageTeamObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveTeamManage);

    public bool CanViewCascadeCoverage(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategicView, PermissionScopes.Tenant)
            || CanViewCycles(user);

    // ─── Feedback identity access (D-07/D-10) ─────────────────────────────────

    public bool CanAccessConfidentialFeedbackIdentity(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ConfidentialIdentityView, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    // ─── Feedback threshold details ───────────────────────────────────────────

    public bool CanViewFeedbackThresholdDetails(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanActOnOwnedException(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ExceptionAction, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ExceptionManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanOverrideException(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ExceptionOverride, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ExceptionManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanViewExceptionAudit(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ExceptionAuditView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ExceptionOverride, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ExceptionManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    // ─── Objective planning configuration ────────────────────────────────────

    public bool CanViewObjectivePlanningConfiguration(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectivePolicyView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant);

    public bool CanManageObjectivePlanningConfiguration(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant);

    // ─── Platform performance configuration (D1: PlatformAdmin only) ─────────

    public bool CanManagePlatformDefaults(ClaimsPrincipal user)
        => user.IsInRole(PlatformRole.PlatformAdmin);
}
