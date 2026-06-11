namespace EY.HRPlatform.Identity.Models.WorkforceAccounts;

public sealed class WorkforceAccountStatusesRequest
{
    public List<WorkforceAccountSubjectDto> Subjects { get; set; } = [];
}

public sealed class WorkforceAccountBulkProvisionRequest
{
    public List<WorkforceAccountProvisionItemDto> Items { get; set; } = [];
}

public class WorkforceAccountSubjectDto
{
    public Guid EmployeeId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}

public sealed class WorkforceAccountProvisionItemDto : WorkforceAccountSubjectDto
{
    public string? Role { get; set; }
}

public sealed class ProvisionWorkforceAccountInviteRequest
{
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string Role { get; set; } = string.Empty;
}

public sealed class WorkforceAccountStatusDto
{
    public Guid EmployeeId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Role { get; set; } = string.Empty;
    public string ProvisioningState { get; set; } = string.Empty;
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

public sealed class WorkforceAccountConflictDto
{
    public string Kind { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool Blocking { get; set; }
    public string? SuggestedAction { get; set; }
}

public sealed class WorkforceAccountBulkProvisionResultDto
{
    public Guid EmployeeId { get; set; }
    public string Outcome { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public WorkforceAccountStatusDto Account { get; set; } = new();
}
