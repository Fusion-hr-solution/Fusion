using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AssignTrainingCommand(
    Guid TrainingId,
    Guid EmployeeId,
    DateTime? DueDate) : ICommand<Result<Guid>>;
