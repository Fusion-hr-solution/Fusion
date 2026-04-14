using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateContentBlockCommand(
    Guid TrainingId,
    Guid ChapterId,
    Guid ContentBlockId,
    string Type,
    string? Title,
    string? TextContent,
    string? ContentUri,
    string? VideoUrl,
    int? EstimatedDurationMinutes) : ICommand<Result>;
