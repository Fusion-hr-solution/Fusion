namespace EY.HRPlatform.Performance.Features.Cycles.Dtos;

using EY.HRPlatform.Performance.Domain.Enums;

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
    IReadOnlyList<PopulationRuleDto> PopulationRules,
    CampaignGovernanceDto? Governance);

public sealed record CampaignGovernanceDto(
    Guid? RetentionPolicyVersionId,
    bool RequireTeamObjectiveSuperiorApproval,
    int MinimumAnonymousFeedbackResponses,
    string FeedbackVisibility,
    IReadOnlyList<Guid> ExceptionOwnerEmployeeIds,
    bool IsFrozen,
    DateTime? FrozenAt);

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
    int ConfirmedObjectiveResponsibilityCount,
    int MissingObjectiveResponsibilityCount,
    IReadOnlyList<CampaignResponsibilityWorkItemDto> MissingParticipants,
    CampaignWorkforceDeltaDto WorkforceDelta,
    IReadOnlyList<OverloadedAssigneeWarningDto> OverloadedAssigneeWarnings);

public sealed record OverloadedAssigneeWarningDto(
    Guid AssigneeEmployeeId,
    string AssigneeName,
    int SubjectCount);

/// <summary>
/// The difference between the responsibilities curated during preparation and the current Core
/// workforce, re-resolved at the launch gate. <see cref="BlocksLaunch"/> is true when an issue
/// (e.g. an inactive/missing final approver) must be re-curated before the campaign can launch.
/// </summary>
public sealed record CampaignWorkforceDeltaDto(
    int InactiveSubjectCount,
    int InactiveOrMissingAssigneeCount,
    bool BlocksLaunch,
    IReadOnlyList<CampaignWorkforceDeltaItemDto> Items);

public sealed record CampaignWorkforceDeltaItemDto(
    Guid SubjectEmployeeId,
    string SubjectFullName,
    Guid AssigneeEmployeeId,
    string AssigneeName,
    string Issue);

public sealed record CampaignResponsibilitySummaryDto(
    Guid Id,
    Guid AssigneeEmployeeId,
    string AssigneeName,
    string Duty,
    string Source,
    string RelationshipSource,
    string? OverrideReason,
    int Revision,
    DateTime RecordedAt);

public sealed record CuratedCampaignResponsibilityDto(
    CampaignResponsibilitySummaryDto Responsibility,
    uint CycleVersion);

public sealed record CampaignResponsibilityWorkItemDto(
    Guid ParticipantId,
    Guid SubjectEmployeeId,
    string SubjectFullName,
    string? OrgUnitName,
    string? JobTitle,
    string? CoreManagerName,
    CampaignResponsibilitySummaryDto? CurrentResponsibility,
    Guid? SubjectOrgUnitId = null,
    Guid? SubjectPrimaryManagerEmployeeId = null);

public sealed record CampaignResponsibilitiesDto(
    int ParticipantCount,
    int ConfirmedObjectiveResponsibilityCount,
    int MissingObjectiveResponsibilityCount,
    IReadOnlyList<CampaignResponsibilityWorkItemDto> Items);

public sealed record CurateCampaignResponsibilityRequest(
    Guid SubjectEmployeeId,
    Guid AssigneeEmployeeId,
    string Duty,
    string RelationshipSource,
    string? OverrideReason);

public sealed record MarkCycleReadyToLaunchRequest(bool AcceptCurrentWorkforceDelta);

public sealed record ConfigureCycleGovernanceRequest(
    Guid RetentionPolicyVersionId,
    bool RequireTeamObjectiveSuperiorApproval,
    int MinimumAnonymousFeedbackResponses,
    string FeedbackVisibility,
    IReadOnlyList<Guid> ExceptionOwnerEmployeeIds);

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

public sealed record WorkforceDeltaDecision(
    Guid SubjectEmployeeId,
    Guid AssigneeEmployeeId,
    bool Accept,
    string? Reason);

public sealed record ApplyWorkforceDeltaResultDto(int Applied, int Rejected);

public sealed record ApplyWorkforceDeltaRequest(IReadOnlyList<WorkforceDeltaDecision> Decisions);

public sealed record ForceCloseExceptionDecisionDto(
    Guid ExceptionCaseId,
    ExceptionResolutionAction Action,
    string Reason);

public sealed record ForceCloseCycleRequest(IReadOnlyList<ForceCloseExceptionDecisionDto> Decisions);
