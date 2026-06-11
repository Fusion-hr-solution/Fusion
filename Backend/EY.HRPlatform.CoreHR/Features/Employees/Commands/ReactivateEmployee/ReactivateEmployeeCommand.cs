using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.ReactivateEmployee;

/// <summary>
/// Command to reactivate an employee.
/// </summary>
/// <param name="ExpectedVersion">Row version for optimistic concurrency check.</param>
public sealed record ReactivateEmployeeCommand(
    Guid EmployeeId,
    uint ExpectedVersion) : ICommand<Result>;