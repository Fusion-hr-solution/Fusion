namespace EY.HRPlatform.Performance.Features.Cycles.Dtos;

using EY.HRPlatform.Performance.Domain.Enums;

public sealed record PerformanceCycleSummaryDto(
    Guid Id,
    string Name,
    string Slug,
    int? ReferenceYear,
    string Type,
    string Status,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    string DeadlineState,
    int ParticipantCount,
    DateTime? LaunchedAt,
    DateTime? ClosedAt,
    DateTime? PlanningLockedAt,
    string? PlanningLockedByName,
    DateTime CreatedAt,
    uint Version);

public sealed record PopulationRuleDto(
    string RuleType,
    Guid RefId,
    bool IncludeDescendants,
    string? Reason);

public sealed record PerformanceCycleDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? Purpose,
    int? ReferenceYear,
    Guid? OwnerUserId,
    string? OwnerName,
    string Type,
    string Status,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? ExpectedPlanningLockDate,
    string DeadlineState,
    bool PopulationIncludeInactive,
    int ParticipantCount,
    DateTime? LaunchedAt,
    DateTime? ClosedAt,
    DateTime? PlanningLockedAt,
    string? PlanningLockedByName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version,
    IReadOnlyList<PopulationRuleDto> PopulationRules,
    CampaignPlanningRulesSnapshotDto? PlanningRulesSnapshot,
    IReadOnlyList<CampaignStrategicObjectiveDto> StrategicObjectives,
    CampaignDraftCompletenessDto DraftCompleteness);

public sealed record CampaignPlanningRulesSnapshotDto(
    int MaxObjectiveCount,
    string AllowedWeightMenu,
    string EnabledMeasurementMethods,
    Guid SourceConfigurationVersionId,
    DateTime CapturedAt);

public sealed record CampaignStrategicObjectiveDto(
    Guid Id,
    string Title,
    string? Description,
    string? ResponsibleFunctionLabel,
    bool IsActive,
    uint Version);

public sealed record CampaignDraftCompletenessDto(
    bool IsComplete,
    IReadOnlyList<string> BlockingReasons);

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
    Guid ApproverEmployeeId,
    string ApproverName,
    bool IsApproverOverridden,
    string? ApproverOverrideReason,
    DateTime SnapshotAt);

public sealed record CyclePopulationMemberDto(
    Guid EmployeeId,
    string FullName,
    string? Email,
    string? JobTitle,
    Guid? OrgUnitId,
    string? OrgUnitName,
    Guid? ManagerId,
    string? ManagerName,
    bool IsActive);

public sealed record CampaignPopulationExclusionDto(
    Guid EmployeeId,
    string? FullName,
    string Reason);

/// <summary>
/// Live preview of the resolved objective-planning population. When no org-unit scope is set,
/// <see cref="IsAllActiveBaseline"/> is true only for legacy/no-scope drafts; launch readiness treats
/// that as an incomplete population decision instead of silently selecting every active employee.
/// </summary>
public sealed record CyclePopulationPreviewDto(
    bool IsAllActiveBaseline,
    int TotalCount,
    IReadOnlyList<CyclePopulationMemberDto> Members,
    IReadOnlyList<CampaignPopulationExclusionDto> Exclusions);

// ----- Launch readiness (computed, not persisted) -----

public sealed record CampaignReadinessParticipantDto(
    Guid EmployeeId,
    string FullName,
    string? OrgUnitName,
    string? JobTitle,
    Guid? ApproverEmployeeId,
    string? ApproverName,
    bool IsApproverOverridden,
    string? ApproverOverrideReason,
    bool HasApprover);

public sealed record CampaignReadinessConditionDto(
    string Code,
    string Severity,
    string Message,
    Guid? EmployeeId);

public sealed record CycleReadinessDto(
    bool CanLaunch,
    bool IsAllActiveBaseline,
    int IncludedCount,
    IReadOnlyList<CampaignReadinessParticipantDto> Participants,
    IReadOnlyList<CampaignPopulationExclusionDto> Exclusions,
    IReadOnlyList<CampaignReadinessConditionDto> BlockingConditions,
    IReadOnlyList<CampaignReadinessConditionDto> InformationalConditions);

public sealed record CampaignLaunchResultDto(
    Guid Id,
    string Status,
    DateTime? LaunchedAt,
    int FrozenParticipantCount,
    uint Version);

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
    bool IncludeDescendants = false,
    string? Reason = null);

public sealed record CreatePerformanceCycleRequest(
    string Name,
    string? Description,
    string? Type,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    int? ReferenceYear,
    string? Purpose,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? ExpectedPlanningLockDate,
    bool PopulationIncludeInactive = false);

public sealed record UpdatePerformanceCycleRequest(
    string Name,
    string? Description,
    string? Type,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    int? ReferenceYear,
    string? Purpose,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? ExpectedPlanningLockDate,
    bool PopulationIncludeInactive = false);

public sealed record UpsertCampaignStrategicObjectiveRequest(
    string Title,
    string? Description,
    string? ResponsibleFunctionLabel);

public sealed record ToggleCampaignStrategicObjectiveRequest(bool IsActive);

public sealed record SetCyclePopulationRequest(
    bool PopulationIncludeInactive,
    IReadOnlyList<PopulationRuleInput> Rules);

public sealed record OverrideParticipantApproverRequest(
    Guid ApproverEmployeeId,
    string Reason);
