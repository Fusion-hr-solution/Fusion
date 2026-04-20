using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record CreateExamCommand(
    Guid TrainingId,
    string Title,
    string? Description,
    int PassingScore,
    int? DurationMinutes) : ICommand<Result<Guid>>;
