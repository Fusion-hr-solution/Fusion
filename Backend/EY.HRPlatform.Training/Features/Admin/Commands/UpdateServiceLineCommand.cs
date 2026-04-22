using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UpdateServiceLineCommand(
    Guid ServiceLineId,
    string Name,
    string Code,
    string Color,
    string? Description,
    bool IsSharedAcrossAllServiceLines) : ICommand<Result>;
