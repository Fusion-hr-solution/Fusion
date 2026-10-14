namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Asks Identity which active accounts of a tenant hold a permission at or above a scope.
/// Services use it when they must name another user by capability (for example a
/// calibration facilitator) and cannot read that user's token.
/// </summary>
public sealed record PermissionHoldersRequest(Guid TenantId, string PermissionKey, string Scope);

public sealed record PermissionHolder(Guid UserId, Guid? EmployeeId, string DisplayName, string Email);
