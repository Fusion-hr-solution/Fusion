namespace EY.HRPlatform.Identity.Models.Responses;

public static class WorkforceAccountProvisioningStates
{
    public const string Unprovisioned = "Unprovisioned";
    public const string InvitePending = "InvitePending";
    public const string InviteExpired = "InviteExpired";
    public const string InviteRevoked = "InviteRevoked";
    public const string InviteAccepted = "InviteAccepted";
    public const string Active = "Active";
    public const string Inactive = "Inactive";
    public const string Conflict = "Conflict";
}

public static class WorkforceAccountConflictKinds
{
    public const string PendingInviteExists = "PendingInviteExists";
    public const string EmailAlreadyRegistered = "EmailAlreadyRegistered";
    public const string EmployeeEmailMismatch = "EmployeeEmailMismatch";
}

public sealed class WorkforceAccountConflictDto
{
    public string Kind { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool Blocking { get; set; }
    public string? SuggestedAction { get; set; }
}

public sealed class WorkforceAccountStatusDto
{
    public Guid EmployeeId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Role { get; set; } = string.Empty;
    public string ProvisioningState { get; set; } = WorkforceAccountProvisioningStates.Unprovisioned;
    public Guid? UserId { get; set; }
    public bool? IsActive { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public Guid? InviteId { get; set; }
    public DateTime? InviteCreatedAt { get; set; }
    public DateTime? InviteExpiresAt { get; set; }
    public string? InviteLink { get; set; }
    public string? DeliveryStatus { get; set; }
    public string? DeliveryMessage { get; set; }
    public DateTime? DeliveryRecordedAt { get; set; }
    public WorkforceAccountConflictDto? Conflict { get; set; }
}
