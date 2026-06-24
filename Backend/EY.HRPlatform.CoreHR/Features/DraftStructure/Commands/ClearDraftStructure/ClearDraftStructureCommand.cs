using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.ClearDraftStructure;

public sealed record ClearDraftStructureCommand(
    Guid? ActorUserId = null,
    string? ActorFullName = null,
    string? ActorRole = null,
    bool IsPlatformAssisted = false) : ICommand<Result>;
