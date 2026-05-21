using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.DeleteDraftOrgUnit;

public sealed record DeleteDraftOrgUnitCommand(
    Guid Id,
    uint ExpectedVersion,
    Guid? ReplacementParentId,
    bool PromoteChildrenToRoot) : ICommand<Result>;