using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;

/// <summary>
/// Command to update an existing employee's details.
/// Supports partial updates - null fields are ignored.
/// </summary>
/// <param name="ExpectedVersion">Row version for optimistic concurrency check.</param>
/// <param name="FirstName">New first name, or null to keep existing.</param>
/// <param name="LastName">New last name, or null to keep existing.</param>
/// <param name="Email">New email, or null to keep existing.</param>
/// <param name="JobTitle">New job title, or null to keep existing.</param>
/// <param name="ManagerId">New manager ID, Guid.Empty to clear, or null to keep existing.</param>
/// <param name="OrgUnitId">New org unit ID, Guid.Empty to clear, or null to keep existing.</param>
/// <param name="HireDate">New hire date, or null to keep existing.</param>
public sealed record UpdateEmployeeCommand(
    Guid EmployeeId,
    uint ExpectedVersion,
    string? FirstName,
    string? LastName,
    string? Email,
    string? JobTitle,
    Guid? ManagerId,
    Guid? OrgUnitId = null,
    DateTime? HireDate = null,
    string? EmployeeNumber = null,
    string? Phone = null,
    string? WorkLocation = null,
    string? EmploymentType = null) : ICommand<Result<EmployeeDto>>;
