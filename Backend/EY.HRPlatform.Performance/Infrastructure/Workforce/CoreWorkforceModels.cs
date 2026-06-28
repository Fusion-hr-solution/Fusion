namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// Minimal projection of a Core workforce employee summary. Only the fields Performance
/// snapshots are mapped; extra JSON fields from Core are ignored on deserialization.
/// </summary>
public sealed record CoreEmployeeSummary(
    Guid EmployeeId,
    string StableEmployeeKey,
    string FullName,
    string DisplayName,
    string WorkEmail,
    string? JobTitle,
    bool IsActive,
    CoreOrgAssignment? OrgUnit,
    CoreManagerSummary? Manager);

public sealed record CoreOrgAssignment(
    Guid OrgUnitId,
    string Name);

public sealed record CoreManagerSummary(
    Guid EmployeeId,
    string DisplayName,
    bool IsActive = true);

public sealed record CoreCampaignWorkforceContext(
    DateTime AsOf,
    string SourceVersion,
    IReadOnlyList<CoreCampaignWorkforceMember> Members);

public sealed record CoreCampaignWorkforceMember(
    Guid EmployeeId,
    bool IsActive,
    IReadOnlyList<Guid> OrgUnitIds,
    Guid? PrimaryManagerEmployeeId,
    IReadOnlyList<Guid> PrimaryManagementChain,
    bool HasPrimaryChainCycle,
    uint EmployeeVersion,
    IReadOnlyList<Guid>? AncestorOrgUnitIds = null,
    IReadOnlyList<CoreCampaignRelationshipCandidate>? RelationshipCandidates = null,
    bool IsPacketAReady = false,
    IReadOnlyList<string>? RemediationCodes = null)
{
    public IReadOnlyList<Guid> AncestorOrgUnitIds { get; init; } = AncestorOrgUnitIds ?? [];
    public IReadOnlyList<CoreCampaignRelationshipCandidate> RelationshipCandidates { get; init; } = RelationshipCandidates ?? [];
    public IReadOnlyList<string> RemediationCodes { get; init; } = RemediationCodes ?? [];
}

public sealed record CoreCampaignRelationshipCandidate(
    Guid RelationshipId,
    Guid SubjectEmployeeId,
    Guid ManagerEmployeeId,
    string Type,
    Guid SubjectWorkAssignmentId,
    Guid ManagerWorkAssignmentId,
    string Source);

/// <summary>
/// Projection of the Core workforce org-unit detail (D-16 seam #2).
/// Includes <see cref="ResponsibleManagerEmployeeId"/> so Performance can route
/// collective-objective approval to the org unit's owner without modelling org
/// structure itself (no shadow model).
/// Extra JSON fields from Core are ignored on deserialization.
/// </summary>
public sealed record CoreOrgUnitDetail(
    Guid OrgUnitId,
    string Code,
    string Name,
    string Type,
    Guid? ParentId,
    Guid? ResponsibleManagerEmployeeId,
    bool IsActive);
