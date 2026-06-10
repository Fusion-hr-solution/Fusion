using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

/// <summary>
/// DTO for Employee data returned by queries and commands.
/// </summary>
public sealed record EmployeeDto(
    Guid Id,
    Guid TenantId,
    string StableEmployeeKey,
    string? EmployeeNumber,
    string FirstName,
    string LastName,
    string? PreferredName,
    string Email,
    string? Phone,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? JobTitle,
    string? WorkLocation,
    string? EmploymentType,
    DateTime HireDate,
    EmployeeStatus Status,
    Guid? ManagerId,
    ManagerDto? Manager,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version)
{
    public string FullName => $"{FirstName} {LastName}";
    public string DisplayName => !string.IsNullOrWhiteSpace(PreferredName)
        ? $"{PreferredName} {LastName}"
        : FullName;
}

/// <summary>
/// Lightweight manager info included in EmployeeDto.
/// </summary>
public sealed record ManagerDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email)
{
    public string FullName => $"{FirstName} {LastName}";
}
