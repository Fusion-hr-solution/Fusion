using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AddCurriculumMappingCommand(
    Guid GradeId,
    Guid ServiceLineId,
    Guid TrainingId,
    bool IsRequired,
    int? OrderIndex) : ICommand<Result<Guid>>;
