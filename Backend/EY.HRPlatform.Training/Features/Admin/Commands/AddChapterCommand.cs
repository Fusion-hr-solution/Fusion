using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AddChapterCommand(
    Guid TrainingId,
    string Title,
    string ContentType,
    string? ContentUri,
    int OrderIndex,
    string? TextContent,
    string? VideoUrl,
    int? EstimatedDurationMinutes) : ICommand<Result<Guid>>;
