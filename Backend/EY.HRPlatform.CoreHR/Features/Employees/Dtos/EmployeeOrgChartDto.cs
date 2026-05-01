namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public sealed record EmployeeOrgChartDto(
    IReadOnlyList<EmployeeOrgChartNodeDto> Roots,
    Guid? RequestedRootEmployeeId,
    int MaxDepthApplied,
    bool IncludeInactive,
    int TotalVisibleNodeCount,
    bool IsTruncated);

public sealed record EmployeeOrgChartNodeDto(
    Guid EmployeeId,
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