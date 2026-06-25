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

    public bool CanViewObjectiveLibrary(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveLibraryView, PermissionScopes.Tenant)
            || user.HasCorePermission(PerformancePermissions.ObjectiveLibraryManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);

    public bool CanManageObjectiveLibrary(ClaimsPrincipal user)
        => user.HasCorePermission(PerformancePermissions.ObjectiveLibraryManage, PermissionScopes.Tenant)
            || user.IsInRole(PlatformRole.PlatformAdmin);
}
