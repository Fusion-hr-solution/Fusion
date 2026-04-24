using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record BulkAssignCurriculumCommand(
    Guid TrainingId,
    bool IsRequired,
    List<Guid>? GradeIds,
    List<Guid>? ServiceLineIds) : ICommand<Result<int>>;
