namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public static class EmployeeReadinessIssueCodes
{
    public const string MissingRequiredField = "MissingRequiredField";
    public const string MissingOrgUnit = "MissingOrgUnit";
    public const string NoManagerAssigned = "NoManagerAssigned";
    public const string ManagerInactive = "ManagerInactive";
    public const string ManagerMissing = "ManagerMissing";
    public const string DeactivationBlocked = "DeactivationBlocked";
}

public static class EmployeeReadinessIssueSeverities
{
    public const string Attention = "Attention";
    public const string Blocker = "Blocker";
}

public static class EmployeeReadinessFixTargetKinds
{
    public const string ProfileIdentity = "ProfileIdentity";
    public const string ProfileEmployment = "ProfileEmployment";
    public const string ProfileOrganization = "ProfileOrganization";
    public const string ReportingRelationships = "ReportingRelationships";
    public const string ProfileStatus = "ProfileStatus";
    public const string ImportHistoryDetail = "ImportHistoryDetail";
}

public sealed record EmployeeReadinessFixTargetDto(
    string Kind,
    Guid? EmployeeId = null,
    Guid? ImportHistoryId = null,
    string? FieldKey = null);

public sealed record EmployeeReadinessIssueDto(
    string Code,
    string Label,
    string Severity,
    string? FieldKey,
    EmployeeReadinessFixTargetDto FixTarget);

public sealed record EmployeeReadinessSummaryDto(
    int EmployeeStateIssueCount,
    int BlockingIssueCount,
    IReadOnlyList<EmployeeReadinessIssueDto> EmployeeStateIssues,
    IReadOnlyList<EmployeeReadinessIssueDto> BlockingIssues)
{
    public bool HasEmployeeStateIssues => EmployeeStateIssueCount > 0;
    public bool HasBlockingIssues => BlockingIssueCount > 0;

    public static EmployeeReadinessSummaryDto Empty { get; } = new(
        0,
        0,
        Array.Empty<EmployeeReadinessIssueDto>(),
        Array.Empty<EmployeeReadinessIssueDto>());
}