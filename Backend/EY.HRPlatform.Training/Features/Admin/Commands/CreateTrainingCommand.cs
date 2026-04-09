using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record CreateTrainingCommand(
    string Title,
    string? Description,
    int Credits,
    bool IsMandatory,
    string BadgeLevel,
    string? Duration,
    Guid CategoryId,
    List<CreateTrainingChapterItem> Chapters) : ICommand<Result<Guid>>;

public record CreateTrainingChapterItem(
    string Title,
    string Layout,
    int OrderIndex,
    List<CreateTrainingContentBlockItem> ContentBlocks);

public record CreateTrainingContentBlockItem(
    string Type,
    int OrderIndex,
    string? Title,
    string? TextContent,
    string? ContentUri,
    string? VideoUrl,
    int? EstimatedDurationMinutes);
