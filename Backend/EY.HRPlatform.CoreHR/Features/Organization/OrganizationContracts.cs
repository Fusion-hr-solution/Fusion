using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Features.Organization;

public sealed record OrganizationUnitStateDto(
    Guid Id,
    string Code,
    string Name,
    Guid TypeId,
    string TypeName,
    Guid? ParentId,
    string? ParentName,
    string Path,
    OrgUnitLifecycleState LifecycleState,
    DateOnly EffectiveFrom,
    uint Version);

public sealed record OrganizationHierarchyNodeDto(
    OrganizationUnitStateDto Unit,
    IReadOnlyList<OrganizationHierarchyNodeDto> Children);

public sealed record OrganizationHierarchyDto(DateOnly AsOf, IReadOnlyList<OrganizationHierarchyNodeDto> Roots);

public sealed record OrganizationReadinessDto(
    bool IsReady,
    string? Reason,
    bool HasPermanentRoot,
    Guid? PermanentRootId,
    DateOnly? PermanentRootFirstEffectiveDate,
    bool IsPermanentRootEffective);

public enum OrganizationBusinessEventKind
{
    Created = 1,
    Renamed = 2,
    TypeChanged = 3,
    Moved = 4,
    Inactivated = 5,
}

public sealed record OrganizationUnitReferenceDto(Guid Id, string Name, string Code);
public sealed record OrganizationTypeReferenceDto(Guid Id, string Name);
public sealed record OrganizationBusinessEventContextDto(
    string Name,
    OrganizationTypeReferenceDto Type,
    OrganizationUnitReferenceDto? Parent,
    OrgUnitLifecycleState LifecycleState);

public sealed record OrganizationChangeDto(
    Guid Id,
    Guid OrgUnitId,
    string UnitName,
    string UnitCode,
    DateOnly EffectiveDate,
    OrganizationChangeKind Kind,
    string? Summary,
    bool IsCancelled,
    IReadOnlyList<OrganizationBusinessEventKind> BusinessEventKinds,
    OrganizationBusinessEventContextDto? Before,
    OrganizationBusinessEventContextDto? After);

public sealed record OrganizationalUnitTypeDto(Guid Id, string DisplayName, bool IsBuiltIn);

public sealed record CreateOrganizationRootRequest(string Code, string Name, DateOnly EffectiveDate);
public sealed record CreateOrganizationUnitRequest(string Code, string Name, Guid TypeId, Guid ParentId, DateOnly EffectiveDate);
public sealed record ChangeOrganizationUnitRequest(string? Name, Guid? TypeId, DateOnly EffectiveDate, string? Reason = null);
public sealed record MoveOrganizationUnitRequest(Guid TargetParentId, DateOnly EffectiveDate, string? Reason = null);
public sealed record InactivateOrganizationUnitRequest(DateOnly EffectiveDate, string? Reason = null);
public sealed record CorrectOrganizationUnitRequest(string? Name, Guid? TypeId, Guid? ParentId, OrgUnitLifecycleState? LifecycleState, DateOnly EffectiveDate, string Reason);
public sealed record CorrectOrganizationCodeRequest(string Code, string Reason);
public sealed record CreateOrganizationalUnitTypeRequest(string Name);
public sealed record RenameOrganizationalUnitTypeRequest(string Name);

public sealed record OrganizationBatchCreateNode(
    string ProposalNodeId,
    string Code,
    string Name,
    Guid TypeId,
    string? ParentProposalNodeId,
    Guid? ParentCanonicalId,
    bool IsRoot);
public sealed record OrganizationBatchCreatedNode(string ProposalNodeId, Guid OrgUnitId, string Code, string Name);
