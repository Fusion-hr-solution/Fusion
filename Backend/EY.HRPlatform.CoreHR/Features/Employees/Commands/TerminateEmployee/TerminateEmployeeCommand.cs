using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.TerminateEmployee;

/// <summary>Command to terminate an employee's active canonical employment chain.</summary>
public sealed record TerminateEmployeeCommand(
    Guid EmployeeId,
    uint ExpectedVersion,
    DateTime EffectiveDate,
    string? Note) : ICommand<Result>;
