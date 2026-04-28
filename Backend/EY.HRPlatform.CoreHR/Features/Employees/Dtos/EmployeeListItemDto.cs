using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

/// <summary>
/// Lightweight DTO for employee list/directory views.
/// </summary>
public sealed record EmployeeListItemDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? JobTitle,
    EmployeeStatus Status,
    DateTime HireDate,
    Guid? ManagerId,
    string? ManagerName)
{
    public string FullName => $"{FirstName} {LastName}";
}
