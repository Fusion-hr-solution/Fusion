using EY.HRPlatform.SharedKernel.Auth;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.Security;

public interface IPerformanceAccessPolicyService
{
    bool CanViewCycles(ClaimsPrincipal user);
    bool CanManageCycles(ClaimsPrincipal user);
    bool CanOperateCycles(ClaimsPrincipal user);
    bool CanViewObjectiveLibrary(ClaimsPrincipal user);
    bool CanManageObjectiveLibrary(ClaimsPrincipal user);

    // Strategic objective access (D-05: deny-by-default; no position auto-grant)
    bool CanViewStrategicObjectives(ClaimsPrincipal user);
    bool CanManageStrategicObjectives(ClaimsPrincipal user);
    bool CanPublishStrategicObjectives(ClaimsPrincipal user);

    // Collective objective access (D-15 collective level)
    bool CanViewCollectiveObjectives(ClaimsPrincipal user);
    bool CanApproveCollectiveObjectives(ClaimsPrincipal user);

    // Progress correction (D-13: manager must have explicit permission)
    bool CanCorrectObjectiveProgress(ClaimsPrincipal user);

    // Feedback identity access (D-07/D-10: exceptional identity resolution)
    bool CanAccessConfidentialFeedbackIdentity(ClaimsPrincipal user);

    // Feedback threshold details (admin/HR only)
    bool CanViewFeedbackThresholdDetails(ClaimsPrincipal user);

    bool CanActOnOwnedException(ClaimsPrincipal user) => false;
    bool CanOverrideException(ClaimsPrincipal user) => false;
    bool CanViewExceptionAudit(ClaimsPrincipal user) => false;

    // Objective policy (P1: policy-and-templates)
    bool CanViewObjectivePolicy(ClaimsPrincipal user) => false;
    bool CanManageObjectivePolicy(ClaimsPrincipal user) => false;

    // Template categories (P1: policy-and-templates)
    bool CanManageTemplateCategories(ClaimsPrincipal user) => false;

    // Platform defaults — gated by PlatformRole.PlatformAdmin only (D1)
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

    // Tenant template content is tenant-owned (P1.1 §6.1): PlatformAdmin gets no implicit access.
    public bool CanViewObjectiveLibrary(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveLibraryView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectiveLibraryManage, PermissionScopes.Tenant);

    public bool CanManageObjectiveLibrary(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveLibraryManage, PermissionScopes.Tenant);

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

    // ─── Collective objective permissions (D-15) ──────────────────────────────

    public bool CanViewCollectiveObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveTeamManage, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectiveTeamApprove, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanApproveCollectiveObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveTeamApprove, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectiveTeamManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    // ─── Progress correction (D-13) ───────────────────────────────────────────

    public bool CanCorrectObjectiveProgress(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveProgressCorrect, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

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

    // ─── Objective policy (P1: policy-and-templates) ──────────────────────────

    public bool CanViewObjectivePolicy(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectivePolicyView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant);

    public bool CanManageObjectivePolicy(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant);

    // ─── Template categories (P1: policy-and-templates) ──────────────────────

    public bool CanManageTemplateCategories(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.TemplateCategoryManage, PermissionScopes.Tenant);

    // ─── Platform defaults (D1: PlatformAdmin only) ───────────────────────────

    public bool CanManagePlatformDefaults(ClaimsPrincipal user)
        => user.IsInRole(PlatformRole.PlatformAdmin);
}
