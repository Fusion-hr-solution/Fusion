using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.CreateDraftOrgUnit;

public sealed record CreateDraftOrgUnitCommand(
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string? Location,
    string? Description,
    Guid? ParentId,
    Dictionary<string, object?>? Attributes,
    Guid? ActorUserId = null,
    string? ActorFullName = null,
    string? ActorRole = null,
    bool IsPlatformAssisted = false) : ICommand<Result<DraftOrgUnitDto>>;
