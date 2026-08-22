using System.Security.Claims;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Features.Security;

/// <summary>
/// Intent-named capability booleans over the caller's claims — the CoreAccessPolicyService
/// pattern, not the Core instance. Controllers check these imperatively and Forbid() first.
/// Server authorization is independent of any UI hiding. This layer answers capability +
/// scope questions from the token; contextual responsibility (manager relationship, objective
/// accountability) is resolved against Core/Performance data by the handlers that need it.
/// </summary>
public interface IPerformanceAccessPolicyService
{
    /// <summary>Can enter Performance at all (any breadth of the view capability).</summary>
    bool CanEnterPerformance(ClaimsPrincipal user);

    /// <summary>Tenant performance administration: settings, cycle lifecycle, population.</summary>
    bool CanAdministerCycles(ClaimsPrincipal user);

    /// <summary>Create/publish company strategic direction.</summary>
    bool CanPublishStrategy(ClaimsPrincipal user);

    /// <summary>Participate: author/submit own plan and own objective progress.</summary>
    bool CanManageOwnParticipation(ClaimsPrincipal user);

    /// <summary>Can review direct reports' plans — the view capability at DirectReports breadth or wider.</summary>
    bool CanReviewDirectReports(ClaimsPrincipal user);

    /// <summary>The widest granted breadth of aggregate visibility, or null if none.</summary>
    string? AggregateViewScope(ClaimsPrincipal user);
}

public sealed class PerformanceAccessPolicyService : IPerformanceAccessPolicyService
{
    public bool CanEnterPerformance(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleView)
            || user.HasCorePermission(PerformancePermissions.ObjectiveSelfManage);

    public bool CanAdministerCycles(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant);

    public bool CanPublishStrategy(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.StrategyPublish, PermissionScopes.Tenant);

    public bool CanManageOwnParticipation(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self);

    public bool CanReviewDirectReports(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.DirectReports)
            || user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.OrgUnit)
            || user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.Tenant);

    public string? AggregateViewScope(ClaimsPrincipal user)
    {
        if (user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.Tenant))
            return PermissionScopes.Tenant;
        if (user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.OrgUnit))
            return PermissionScopes.OrgUnit;
        if (user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.DirectReports))
            return PermissionScopes.DirectReports;
        if (user.HasCorePermission(PerformancePermissions.CycleView, PermissionScopes.Self))
            return PermissionScopes.Self;
        return null;
    }
}
