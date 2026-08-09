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

public sealed record OrganizationReadinessDto(bool IsReady, string? Reason);

public sealed record OrganizationChangeDto(
    Guid Id,
    Guid OrgUnitId,
    string UnitName,
    string UnitCode,
    DateOnly EffectiveDate,
    OrganizationChangeKind Kind,
    string? Summary,
    bool IsCancelled);

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
