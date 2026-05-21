namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public sealed record WorkforceReadinessIssueCountsDto(
    int MissingRequiredFields,
    int MissingOrgUnit,
    int NoManagerAssigned,
    int ManagerInactive,
    int ManagerMissing,
    int DeactivationBlocked,
    int UnresolvedImportIssues);

public sealed record WorkforceReadinessSummaryDto(
    int ActiveEmployeeCount,
    int ReadyEmployeeCount,
    int EmployeesNeedingAttention,
    decimal ReadinessScore,
    WorkforceReadinessIssueCountsDto IssueCounts);