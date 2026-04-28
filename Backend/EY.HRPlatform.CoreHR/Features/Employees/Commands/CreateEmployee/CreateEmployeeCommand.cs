using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.CreateEmployee;

/// <summary>
/// Command to create a new employee within the current tenant.
/// </summary>
public sealed record CreateEmployeeCommand(
    string FirstName,
    string LastName,
    string Email,
    DateTime HireDate,
    string? JobTitle = null,
    Guid? ManagerId = null,
    Guid? OrgUnitId = null) : ICommand<Result<EmployeeDto>>;
