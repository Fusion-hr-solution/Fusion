using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record ReorderChaptersCommand(
    Guid TrainingId,
    List<Guid> ChapterIds) : ICommand<Result>;
