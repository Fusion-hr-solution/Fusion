using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

/// <summary>
/// Lightweight DTO for employee list/directory views.
/// </summary>
public sealed record EmployeeListItemDto(
    Guid Id,
    string StableEmployeeKey,
    string? EmployeeNumber,
    string FirstName,
    string LastName,
    string? PreferredName,
    string Email,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? JobTitle,
    EmployeeStatus Status,
    DateTime HireDate,
    Guid? ManagerId,
    string? ManagerName,
    string HierarchyStatus,
    int DirectReportCount,
    uint Version)
{
    public string FullName => $"{FirstName} {LastName}";
    public string DisplayName => !string.IsNullOrWhiteSpace(PreferredName)
        ? $"{PreferredName} {LastName}"
        : FullName;

    public EmployeeReadinessSummaryDto Readiness { get; init; } = EmployeeReadinessSummaryDto.Empty;
}

public static class EmployeeHierarchyStatuses
{
    public const string Healthy = "Healthy";
    public const string Root = "Root";
    public const string NoManagerAssigned = "NoManagerAssigned";
    public const string ManagerInactive = "ManagerInactive";
    public const string ManagerMissing = "ManagerMissing";
}
