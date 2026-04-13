using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record ReorderContentBlocksCommand(
    Guid TrainingId,
    Guid ChapterId,
    List<Guid> ContentBlockIds) : ICommand<Result>;
