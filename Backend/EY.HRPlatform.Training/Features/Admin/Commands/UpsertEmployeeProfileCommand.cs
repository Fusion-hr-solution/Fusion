using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpsertEmployeeProfileCommand(
    Guid EmployeeId,
    Guid? GradeId,
    Guid? ServiceLineId) : ICommand<Result>;
