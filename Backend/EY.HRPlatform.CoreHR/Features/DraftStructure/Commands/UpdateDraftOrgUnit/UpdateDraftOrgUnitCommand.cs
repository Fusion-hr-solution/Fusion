using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.UpdateDraftOrgUnit;

public sealed record UpdateDraftOrgUnitCommand(
    Guid Id,
    string Code,
    string Name,
    string Type,
    Guid? ParentId,
    uint ExpectedVersion) : ICommand<Result<DraftOrgUnitDto>>;