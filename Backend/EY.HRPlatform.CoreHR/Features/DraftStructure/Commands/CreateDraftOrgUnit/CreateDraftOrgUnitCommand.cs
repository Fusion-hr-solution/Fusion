using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.CreateDraftOrgUnit;

public sealed record CreateDraftOrgUnitCommand(
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string? BusinessCode,
    string? Description,
    Guid? ParentId,
    Dictionary<string, object?>? Attributes) : ICommand<Result<DraftOrgUnitDto>>;