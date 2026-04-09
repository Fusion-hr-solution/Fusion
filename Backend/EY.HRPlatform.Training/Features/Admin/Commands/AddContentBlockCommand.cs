using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AddContentBlockCommand(
    Guid TrainingId,
    Guid ChapterId,
    string Type,
    int OrderIndex,
    string? Title,
    string? TextContent,
    string? ContentUri,
    string? VideoUrl,
    int? EstimatedDurationMinutes) : ICommand<Result<Guid>>;
