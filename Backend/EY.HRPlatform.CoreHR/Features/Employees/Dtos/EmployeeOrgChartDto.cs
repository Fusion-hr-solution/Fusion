namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public sealed record EmployeeOrgChartDto(
    IReadOnlyList<EmployeeOrgChartNodeDto> Roots,
    Guid? RequestedRootEmployeeId,
    Guid? FocusedEmployeeId,
    Guid? SelectedOrgUnitId,
    int MaxDepthApplied,
    bool IncludeInactive,
    int TotalVisibleNodeCount,
    bool IsTruncated,
    OrgChartIssueCountsDto IssueCounts);

public sealed record OrgChartIssueCountsDto(
    int NoManagerAssigned,
    int ManagerInactive,
    int ManagerMissing,
    int MissingOrgUnit);

public sealed record EmployeeOrgChartNodeDto(
    Guid EmployeeId,
    string StableEmployeeKey,
    string FullName,
    string FirstName,
    string LastName,
    string Email,
    string? JobTitle,
    Domain.Enums.EmployeeStatus EmploymentStatus,
    Guid? OrgUnitId,
    string? OrgUnitName,
    Guid? ManagerId,
    string? ManagerName,
    string HierarchyStatus,
    int DirectReportCount,
    bool HasChildren,
    bool IsOrphaned,
    int Level,
    List<EmployeeOrgChartNodeDto> Children,
    uint Version);