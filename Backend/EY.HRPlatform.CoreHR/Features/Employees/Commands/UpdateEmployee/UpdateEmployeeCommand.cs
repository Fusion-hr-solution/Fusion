using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateEmployee;

/// <summary>
/// Command to update an existing employee's details.
/// </summary>
/// <param name="ExpectedVersion">Row version for optimistic concurrency check.</param>
public sealed record UpdateEmployeeCommand(
    Guid EmployeeId,
    uint ExpectedVersion,
    string FirstName,
    string LastName,
    string Email,
    string? Department,
    string? JobTitle,
    Guid? ManagerId) : ICommand<Result<EmployeeDto>>;
