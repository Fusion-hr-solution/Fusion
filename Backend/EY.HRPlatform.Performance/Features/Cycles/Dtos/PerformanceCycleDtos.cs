namespace EY.HRPlatform.Performance.Features.Cycles.Dtos;

public sealed record PerformanceCycleSummaryDto(
    Guid Id,
    string Name,
    string Type,
    string Status,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    string DeadlineState,
    int ParticipantCount,
    DateTime? PublishedAt,
    DateTime? ActivatedAt,
    DateTime? ClosedAt,
    DateTime CreatedAt,
    uint Version);

public sealed record PopulationRuleDto(
    string RuleType,
    Guid RefId,
    bool IncludeDescendants);

public sealed record PerformanceCycleDetailDto(
    Guid Id,
    string Name,
    string? Description,
    string Type,
    string Status,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    string DeadlineState,
    bool PopulationIncludeInactive,
    int ParticipantCount,
    DateTime? PublishedAt,
    DateTime? ActivatedAt,
    DateTime? ClosedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version,
    IReadOnlyList<PopulationRuleDto> PopulationRules);

public sealed record CycleParticipantDto(
    Guid Id,
    Guid EmployeeId,
    string? EmployeeKey,
    string FullName,
    string? Email,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? JobTitle,
    Guid? ManagerId,
    string? ManagerName,
    Guid? PlanningApproverEmployeeId,
    string? PlanningApproverName,
    string PlanningApproverSource,
    string? PlanningApproverOverrideReason,
    DateTime SnapshotAt);

public sealed record CyclePopulationMemberDto(
    Guid EmployeeId,
    string FullName,
    string? Email,
    string? JobTitle,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? ManagerName,
    bool IsActive);

public sealed record CycleReadinessDto(
    int ParticipantCount,
    int ResolvedPlanningApproverCount,
    int UnresolvedPlanningApproverCount,
    IReadOnlyList<CycleParticipantDto> UnresolvedParticipants);

public sealed record AssignPlanningApproverRequest(Guid ApproverEmployeeId, string Reason);

public sealed record CurateCampaignResponsibilityRequest(
    Guid SubjectEmployeeId,
    Guid AssigneeEmployeeId,
    string Duty,
    string RelationshipSource,
    string? OverrideReason);

public sealed record MarkCycleReadyToLaunchRequest(bool AcceptCurrentWorkforceDelta);

public sealed record CyclePopulationPreviewDto(
    int TotalCount,
    IReadOnlyList<CyclePopulationMemberDto> Members);

public sealed record CycleAuditEventDto(
    Guid Id,
    string Action,
    Guid? ActorUserId,
    string? ActorName,
    DateTime OccurredAt,
    string? Details);

// ----- Request payloads -----

public sealed record PopulationRuleInput(
    string RuleType,
    Guid RefId,
    bool IncludeDescendants = false);

public sealed record CreatePerformanceCycleRequest(
    string Name,
    string? Description,
    string Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    bool PopulationIncludeInactive = false);

public sealed record UpdatePerformanceCycleRequest(
    string Name,
    string? Description,
    string Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    bool PopulationIncludeInactive = false);

public sealed record SetCyclePopulationRequest(
    bool PopulationIncludeInactive,
    IReadOnlyList<PopulationRuleInput> Rules);
