using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateChapterCommand(
    Guid TrainingId,
    Guid ChapterId,
    string Title,
    string ContentType,
    string? ContentUri,
    int OrderIndex,
    string? TextContent,
    string? VideoUrl,
    int? EstimatedDurationMinutes) : ICommand<Result>;
