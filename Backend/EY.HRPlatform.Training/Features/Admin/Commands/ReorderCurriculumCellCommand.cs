using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record ReorderCurriculumCellCommand(
    Guid GradeId,
    Guid ServiceLineId,
    List<Guid> MappingIds) : ICommand<Result>;
