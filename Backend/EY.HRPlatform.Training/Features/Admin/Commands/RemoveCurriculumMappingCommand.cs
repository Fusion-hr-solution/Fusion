using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record RemoveCurriculumMappingCommand(Guid MappingId) : ICommand<Result>;
