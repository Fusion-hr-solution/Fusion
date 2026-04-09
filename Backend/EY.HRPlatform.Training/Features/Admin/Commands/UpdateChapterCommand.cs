using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateChapterCommand(
    Guid TrainingId,
    Guid ChapterId,
    string Title,
    string Layout) : ICommand<Result>;
