using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

/// <summary>
/// Read-focused DTO for the employee profile page.
/// Surfaces identity, employment, organisation context, reporting summary,
/// and data-quality indicators in a single contract.
/// </summary>
public sealed record EmployeeProfileDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string? JobTitle,
    DateTime HireDate,
    EmployeeStatus Status,
    Guid? OrgUnitId,
    string? OrgUnitName,
    Guid? ManagerId,
    string? ManagerFirstName,
    string? ManagerLastName,
    string? ManagerEmail,
    string HierarchyStatus,
    int DirectReportCount,
    uint Version)
{
    public string FullName => $"{FirstName} {LastName}";
    public string? ManagerFullName => ManagerFirstName is not null && ManagerLastName is not null
        ? $"{ManagerFirstName} {ManagerLastName}"
        : null;
}
