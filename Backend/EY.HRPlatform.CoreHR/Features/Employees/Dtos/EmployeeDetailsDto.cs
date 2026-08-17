using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

public sealed record EmployeeDetailsDto(
    Guid Id,
    Guid TenantId,
    string StableEmployeeKey,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string? PreferredName,
    string? Email,
    string? Phone,
    EmployeeCurrentEmploymentDto? CurrentEmployment,
    EmployeeCurrentWorkAssignmentDto? CurrentWorkAssignment,
    EmployeeCurrentManagerDto? CurrentManager,
    EmployeeHistorySummaryDto HistorySummary,
    EmployeeReadinessSummaryDto Readiness,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version)
{
    public string FullName => $"{FirstName} {LastName}";
    public string DisplayName => !string.IsNullOrWhiteSpace(PreferredName)
        ? $"{PreferredName} {LastName}"
        : FullName;
}

public sealed record EmployeeCurrentEmploymentDto(
    Guid EmploymentId,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo,
    EmploymentStatus Status,
    string? EmploymentType);

public sealed record EmployeeCurrentWorkAssignmentDto(
    Guid WorkAssignmentId,
    Guid EmploymentId,
    Guid OrgUnitId,
    string? OrgUnitName,
    string? OrgUnitType,
    string JobTitle,
    string? WorkLocation,
    bool IsPrimary,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo);

public sealed record EmployeeCurrentManagerDto(
    Guid RelationshipId,
    Guid ManagerEmployeeId,
    Guid ManagerWorkAssignmentId,
    string ManagerFirstName,
    string ManagerLastName,
    string? ManagerEmail,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo)
{
    public string ManagerFullName => $"{ManagerFirstName} {ManagerLastName}";
}

public sealed record EmployeeHistorySummaryDto(
    int EmploymentCount,
    int WorkAssignmentCount,
    int ManagerRelationshipCount);
