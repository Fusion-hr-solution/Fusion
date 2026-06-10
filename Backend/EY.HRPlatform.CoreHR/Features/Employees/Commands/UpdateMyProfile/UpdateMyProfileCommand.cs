using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateMyProfile;

public sealed record UpdateMyProfileCommand(
    Guid EmployeeId,
    uint ExpectedVersion,
    string? PreferredName) : ICommand<Result<uint>>;