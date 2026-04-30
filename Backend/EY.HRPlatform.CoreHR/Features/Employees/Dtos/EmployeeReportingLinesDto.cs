namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public sealed record EmployeeHierarchyNodeDto(
    EmployeeListItemDto Employee,
    int Depth);

public sealed record EmployeeReportingLinesDto(
    EmployeeListItemDto Employee,
    IReadOnlyList<EmployeeHierarchyNodeDto> ManagerChain,
    IReadOnlyList<EmployeeHierarchyNodeDto> DirectReports,
    IReadOnlyList<EmployeeHierarchyNodeDto> Downline,
    int DirectReportCount,
    int DownlineCount);