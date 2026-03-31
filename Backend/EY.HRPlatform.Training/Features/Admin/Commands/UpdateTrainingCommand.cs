using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateTrainingCommand(
    Guid TrainingId,
    string Title,
    string? Description,
    int Credits,
    bool IsMandatory,
    string BadgeLevel,
    string? Duration,
    Guid CategoryId) : ICommand<Result>;
