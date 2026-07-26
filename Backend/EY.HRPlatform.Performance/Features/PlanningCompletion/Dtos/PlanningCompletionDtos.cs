namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;

public sealed record PlanningCompletionWorkspaceDto(
    string State,
    Guid CycleId,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? ExpectedPlanningLockDate,
    DateTime? LaunchedAt,
    DateTime? PlanningLockedAt,
    string? PlanningLockedByName,
    uint Version,
    PlanningCompletionSummaryDto Summary,
    IReadOnlyList<PlanningCompletionRemainingGroupDto> RemainingGroups,
    PlanningCompletionParticipantPageDto Participants);

public sealed record PlanningCompletionSummaryDto(
    int TotalParticipants,
    int ApprovedCount,
    int ExcludedCount,
    int RemainingCount,
    int NotStartedCount,
    int DraftCount,
    int SubmittedCount,
    int ChangesRequestedCount,
    int BlockedCount,
    int OverdueCount,
    int ReminderNeededCount,
    bool IsReadyToLock);

public sealed record PlanningCompletionRemainingGroupDto(
    string Code,
    string Label,
    int Count);

public sealed record PlanningCompletionParticipantPageDto(
    IReadOnlyList<PlanningCompletionParticipantDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record PlanningCompletionParticipantDto(
    Guid ParticipantEmployeeId,
    string EmployeeName,
    string? EmployeeKey,
    string? Email,
    string? JobTitle,
    string? OrgUnitName,
    string Status,
    string StatusLabel,
    bool IsApproved,
    bool IsExcluded,
    bool IsBlocked,
    bool IsOverdue,
    bool ReminderNeeded,
    DateTime? LastActivityAt,
    PlanningCompletionPlanDto? Plan,
    PlanningCompletionReviewerDto FrozenReviewer,
    PlanningCompletionReviewerDto EffectiveReviewer,
    bool ReviewerWasReassigned,
    PlanningCompletionExclusionDto? Exclusion,
    IReadOnlyList<PlanningCompletionBlockerDto> Blockers,
    IReadOnlyList<PlanningCompletionOverdueDto> OverdueIndicators,
    PlanningCompletionReminderDto? LastReminder);

public sealed record PlanningCompletionParticipantDetailDto(
    PlanningCompletionParticipantDto Participant,
    IReadOnlyList<PlanningCompletionReminderDto> ReminderHistory,
    IReadOnlyList<PlanningCompletionReassignmentDto> ReassignmentHistory);

public sealed record PlanningCompletionPlanDto(
    Guid PlanId,
    string Status,
    string StatusLabel,
    int ObjectiveCount,
    int TotalWeight,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    uint Version);

public sealed record PlanningCompletionReviewerDto(
    Guid? EmployeeId,
    string? Name,
    bool? IsActive);

public sealed record PlanningCompletionBlockerDto(
    string Code,
    string Label);

public sealed record PlanningCompletionOverdueDto(
    string Code,
    string Label,
    DateTime Deadline);

public sealed record PlanningCompletionExclusionDto(
    string Reason,
    string? ExcludedByName,
    DateTime ExcludedAt);

public sealed record PlanningCompletionReminderDto(
    Guid Id,
    Guid TargetEmployeeId,
    string TargetName,
    string TargetType,
    string Reason,
    string? RecordedByName,
    DateTime RecordedAt,
    bool NotificationTriggered);

public sealed record PlanningCompletionReassignmentDto(
    Guid Id,
    Guid? PreviousApproverEmployeeId,
    string? PreviousApproverName,
    Guid NewApproverEmployeeId,
    string NewApproverName,
    string Reason,
    string? ReassignedByName,
    DateTime ReassignedAt);

public sealed record RecordPlanningReminderRequest(
    Guid TargetEmployeeId,
    string TargetType,
    string Reason,
    Guid? ParticipantEmployeeId = null,
    Guid? PlanId = null,
    bool TriggerNotification = false);

public sealed record ReassignPlanningReviewerRequest(
    Guid NewApproverEmployeeId,
    string Reason);

public sealed record ExcludePlanningParticipantRequest(string Reason);

public sealed record LockPlanningRequest(string Confirmation);
