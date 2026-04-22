using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record CreateGradeCommand(
    string Name,
    int Level,
    string? Description,
    string? Icon) : ICommand<Result<Guid>>;
