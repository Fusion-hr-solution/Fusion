using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.MyTrainings.Commands;

public record UpdateContentBlockProgressCommand(
    Guid EmployeeId,
    Guid TrainingId,
    Guid ChapterId,
    Guid ContentBlockId,
    bool Completed) : ICommand<Result>;
