using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record DeleteContentBlockCommand(
    Guid TrainingId,
    Guid ChapterId,
    Guid ContentBlockId) : ICommand<Result>;
