using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.DeactivateEmployee;

/// <summary>
/// Command to deactivate (soft-delete) an employee.
/// </summary>
/// <param name="ExpectedVersion">Row version for optimistic concurrency check.</param>
public sealed record DeactivateEmployeeCommand(
    Guid EmployeeId,
    uint ExpectedVersion) : ICommand<Result>;
