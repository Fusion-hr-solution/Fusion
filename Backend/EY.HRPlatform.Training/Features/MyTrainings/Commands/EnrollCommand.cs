using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.MyTrainings.Commands;

public record EnrollCommand(Guid EmployeeId, Guid TrainingId) : ICommand<Result<Guid>>;
