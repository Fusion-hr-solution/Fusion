using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.MyTrainings.Commands;

public record UpdateChapterProgressCommand(Guid EmployeeId, Guid TrainingId, Guid ChapterId, bool Completed) : ICommand<Result>;
