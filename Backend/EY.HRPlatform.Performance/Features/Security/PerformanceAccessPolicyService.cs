using EY.HRPlatform.SharedKernel.Auth;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.Security;

public interface IPerformanceAccessPolicyService
{
    bool CanViewCycles(ClaimsPrincipal user);
    bool CanManageCycles(ClaimsPrincipal user);
    bool CanOperateCycles(ClaimsPrincipal user);

    // Strategic visibility (D-05: deny-by-default; no position auto-grant)
    bool CanViewStrategicObjectives(ClaimsPrincipal user);

    // Team objectives (P1.3): capability permission only — frozen-baseline responsibility
    // and ownership are enforced per operation in the handlers.
    bool CanManageTeamObjectives(ClaimsPrincipal user) => false;

    // Employee objective plans (P1.4): self-authoring only; ownership is enforced per operation.
    bool CanManageOwnObjectives(ClaimsPrincipal user) => false;

    // Employee objective plan approval (P1.5): permission opens the door; frozen
    // approver assignment is enforced per plan in the approval handlers.
    bool CanApproveEmployeePlans(ClaimsPrincipal user) => false;

    // Team progress visibility (progress record): permission opens the door; effective-reviewer
    // scope is enforced per participant in the team-progress handlers.
    bool CanViewTeamProgress(ClaimsPrincipal user) => false;

    // Check-ins (performance record step 2): the reviewer door opens on the conduct permission;
    // per-participant effective-reviewer scope is enforced in the check-in access guard. The
    // employee door is strictly self-scoped.
    bool CanConductCheckIns(ClaimsPrincipal user) => false;
    bool CanViewOwnCheckIns(ClaimsPrincipal user) => false;

    // Cascade coverage read (P1.3): Direction door (strategic view) or HR door (cycle view/manage).
    bool CanViewCascadeCoverage(ClaimsPrincipal user) => false;

    // Objective planning configuration
    bool CanViewObjectivePlanningConfiguration(ClaimsPrincipal user) => false;
    bool CanManageObjectivePlanningConfiguration(ClaimsPrincipal user) => false;

    // Evaluation configuration and rounds. Permissions open the relevant door; tenant ownership,
    // participant ownership, and frozen effective-reviewer scope are enforced in handlers.
    bool CanManageEvaluations(ClaimsPrincipal user) => false;
    bool CanOperateEvaluations(ClaimsPrincipal user) => false;
    bool CanViewOwnEvaluations(ClaimsPrincipal user) => false;
    bool CanViewTeamEvaluations(ClaimsPrincipal user) => false;

    // Skills catalogue configuration door — tenant-scoped, deny-by-default.
    bool CanManageSkills(ClaimsPrincipal user) => false;

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
            || user.HasCorePermission(PerformancePermissions.CyclePublish, PermissionScopes.Tenant);

    public bool CanManageCycles(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant);

    public bool CanOperateCycles(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CyclePublish, PermissionScopes.Tenant);

    // ─── Strategic visibility (D-05) ──────────────────────────────────────────
    // The tenant strategic-objective library was removed; `performance.strategic.view` is retained
    // because cascade coverage and the Direction "Strategy" door read through it.

    public bool CanViewStrategicObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategicView, PermissionScopes.Tenant);

    // ─── Team objectives + cascade coverage (P1.3) ────────────────────────────

    /// <summary>
    /// Any catalog scope of the team-objective permission qualifies: the effective scope is the
    /// frozen approver baseline, which is stricter than permission scope. No PlatformAdmin bypass —
    /// team objectives are owned business content, not administration.
    /// </summary>
    public bool CanManageTeamObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveTeamManage);

    /// <summary>
    /// Employee objective authoring is strictly self-scoped. No Tenant/PlatformAdmin bypass:
    /// resource ownership still comes from the frozen participant baseline in handlers.
    /// </summary>
    public bool CanManageOwnObjectives(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self);

    public bool CanApproveEmployeePlans(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveTeamApprove);

    /// <summary>
    /// Team progress is a distinct managerial job from plan approval, so it has its own permission.
    /// The door opens on the permission; per-participant effective-reviewer scope is enforced in
    /// the handlers (hide-don't-deny when the scope is empty).
    /// </summary>
    public bool CanViewTeamProgress(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveProgressTeamView);

    /// <summary>
    /// The check-in reviewer door opens on the conduct permission at any catalog scope; the
    /// effective-reviewer rule (stricter than permission scope) is enforced per participant in the
    /// <c>CheckInAccessGuard</c>. No PlatformAdmin bypass — check-ins are owned business content.
    /// </summary>
    public bool CanConductCheckIns(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CheckInConduct);

    /// <summary>
    /// The employee check-in surface is strictly self-scoped. No Tenant/PlatformAdmin bypass:
    /// record ownership still comes from the participant identity in handlers.
    /// </summary>
    public bool CanViewOwnCheckIns(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CheckInSelfView, PermissionScopes.Self);

    public bool CanViewCascadeCoverage(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategicView, PermissionScopes.Tenant)
            || CanViewCycles(user);

    // ─── Objective planning configuration ────────────────────────────────────

    public bool CanViewObjectivePlanningConfiguration(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectivePolicyView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant);

    public bool CanManageObjectivePlanningConfiguration(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant);

    // ─── Evaluation configuration, operations, and work-entry doors ─────────

    public bool CanManageEvaluations(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant);

    public bool CanOperateEvaluations(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.EvaluationOperate, PermissionScopes.Tenant);

    public bool CanViewOwnEvaluations(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.EvaluationSelfView, PermissionScopes.Self);

    public bool CanViewTeamEvaluations(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.EvaluationTeamView);

    // ─── Skills catalogue configuration ──────────────────────────────────────

    public bool CanManageSkills(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.SkillsManage, PermissionScopes.Tenant);

    // ─── Platform performance configuration (D1: PlatformAdmin only) ─────────

    public bool CanManagePlatformDefaults(ClaimsPrincipal user)
        => user.IsInRole(PlatformRole.PlatformAdmin);
}
