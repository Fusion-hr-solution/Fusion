namespace EY.HRPlatform.Identity.Models.Responses;

public static class WorkforceAccountBulkProvisionOutcomes
{
    public const string Created = "Created";
    public const string Pending = "Pending";
    public const string Active = "Active";
    public const string Inactive = "Inactive";
    public const string Conflict = "Conflict";
}

public sealed class WorkforceAccountBulkProvisionResultDto
{
    public Guid EmployeeId { get; set; }
    public string Outcome { get; set; } = WorkforceAccountBulkProvisionOutcomes.Conflict;
    public string Message { get; set; } = string.Empty;
    public WorkforceAccountStatusDto Account { get; set; } = new();
}