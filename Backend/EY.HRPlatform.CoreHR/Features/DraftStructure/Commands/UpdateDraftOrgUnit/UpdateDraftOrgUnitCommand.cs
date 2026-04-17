using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.UpdateDraftOrgUnit;

public sealed record UpdateDraftOrgUnitCommand(
    Guid Id,
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string? Location,
    string? Description,
    Guid? ParentId,
    uint ExpectedVersion,
    Dictionary<string, object?>? Attributes) : ICommand<Result<DraftOrgUnitDto>>;