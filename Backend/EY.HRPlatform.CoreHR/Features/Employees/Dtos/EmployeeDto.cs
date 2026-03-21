using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Features.Employees.Dtos;

/// <summary>
/// DTO for Employee data returned by queries and commands.
/// </summary>
public sealed record EmployeeDto(
    Guid Id,
    Guid TenantId,
    string FirstName,
    string LastName,
    string Email,
    string? Department,
    string? JobTitle,
    DateTime HireDate,
    EmployeeStatus Status,
    Guid? ManagerId,
    ManagerDto? Manager,
    DateTime CreatedAt,
    DateTime? UpdatedAt)
{
    public string FullName => $"{FirstName} {LastName}";
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
