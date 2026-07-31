using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.ChangeEmployeeManager;

/// <summary>
/// Command to atomically end an employee's current active primary manager relationship and create a
/// new one effective the given date. Acts as the first manager assignment when none currently exists.
/// </summary>
public sealed record ChangeEmployeeManagerCommand(
    Guid EmployeeId,
    uint ExpectedVersion,
    Guid ManagerId,
    DateTime EffectiveDate) : ICommand<Result<EmployeeDetailsDto>>;
