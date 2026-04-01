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
    string ContentType,
    string? ContentUri,
    int OrderIndex,
    string? TextContent,
    string? VideoUrl,
    int? EstimatedDurationMinutes);
