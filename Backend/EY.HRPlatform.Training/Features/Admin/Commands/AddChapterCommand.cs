using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AddChapterCommand(
    Guid TrainingId,
    string Title,
    string Layout,
    int OrderIndex,
    List<AddChapterContentBlockItem> ContentBlocks) : ICommand<Result<Guid>>;

public record AddChapterContentBlockItem(
    string Type,
    int OrderIndex,
    string? Title,
    string? TextContent,
    string? ContentUri,
    string? VideoUrl,
    int? EstimatedDurationMinutes);
