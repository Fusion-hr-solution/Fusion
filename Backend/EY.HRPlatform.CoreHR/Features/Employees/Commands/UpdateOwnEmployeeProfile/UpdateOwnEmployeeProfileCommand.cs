using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateOwnEmployeeProfile;

public sealed record UpdateOwnEmployeeProfileCommand(
    Guid EmployeeId,
    uint ExpectedVersion,
    string? PreferredName) : ICommand<Result>;
