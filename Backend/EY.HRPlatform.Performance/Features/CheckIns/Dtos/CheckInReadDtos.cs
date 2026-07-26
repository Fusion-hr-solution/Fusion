using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.CheckIns.Dtos;

public sealed record CheckInLinkedObjectiveDto(Guid ObjectiveId, string ObjectiveTitle, bool WasDiscussed);

public sealed record CheckInRescheduleEntryDto(
    DateTime PreviousDate,
    string? PreviousTime,
    DateTime NewDate,
    string? NewTime,
    string ActorName,
    DateTime OccurredAt);

public sealed record CheckInAddendumDto(Guid Id, string AuthorName, string Text, DateTime CreatedAtUtc);

public sealed record CheckInResponseDto(string Text, DateTime CreatedAtUtc);

public sealed record FollowUpActionStatusEventDto(
    FollowUpActionStatus FromStatus,
    FollowUpActionStatus ToStatus,
    string ActorName,
    string? Note,
    DateTime OccurredAt);

public sealed record FollowUpActionDto(
    Guid Id,
    Guid CheckInId,
    string Description,
    FollowUpActionOwnerKind OwnerKind,
    Guid OwnerEmployeeId,
    string OwnerName,
    DateTime DueDate,
    Guid? LinkedObjectiveId,
    FollowUpActionStatus Status,
    bool IsOverdue,
    string? ResolutionNote,
    DateTime? ResolvedAt,
    uint Version,
    IReadOnlyList<FollowUpActionStatusEventDto> StatusEvents);

public sealed record DiscussionSignalDto(
    Guid Id,
    Guid ObjectiveId,
    string ObjectiveTitle,
    string? Note,
    DiscussionSignalStatus Status,
    Guid? LinkedCheckInId,
    Guid? ResolvedByCheckInId,
    string? CloseReason,
    DateTime RaisedAt,
    DateTime? ResolvedAt);

/// <summary>Compact card used in list/queue surfaces.</summary>
public sealed record CheckInSummaryDto(
    Guid Id,
    Guid CycleId,
    CheckInStatus Status,
    DateTime PlannedDate,
    string? PlannedTime,
    string Reason,
    bool IsOverdue,
    int LinkedObjectiveCount,
    string CreatedByReviewerName,
    DateTime? CompletedAt,
    bool HasResponse,
    uint Version);

/// <summary>Full check-in detail for the focused route.</summary>
public sealed record CheckInDetailDto(
    Guid Id,
    Guid CycleId,
    Guid EmployeeId,
    string EmployeeName,
    string CreatedByReviewerName,
    CheckInStatus Status,
    DateTime PlannedDate,
    string? PlannedTime,
    string Reason,
    string? Agenda,
    bool IsOverdue,
    uint Version,
    string? CompletionSummary,
    string? CompletedByReviewerName,
    DateTime? CompletedAt,
    string? CancellationReason,
    DateTime? CancelledAt,
    IReadOnlyList<CheckInLinkedObjectiveDto> LinkedObjectives,
    IReadOnlyList<CheckInRescheduleEntryDto> RescheduleHistory,
    IReadOnlyList<CheckInAddendumDto> Addenda,
    CheckInResponseDto? Response,
    IReadOnlyList<FollowUpActionDto> Actions);

/// <summary>Reviewer panel for a single participant within Team progress.</summary>
public sealed record CheckInParticipantPanelDto(
    Guid EmployeeId,
    string EmployeeName,
    IReadOnlyList<DiscussionSignalDto> OpenDiscussionSignals,
    IReadOnlyList<CheckInSummaryDto> Upcoming,
    IReadOnlyList<CheckInSummaryDto> Overdue,
    IReadOnlyList<FollowUpActionDto> UnresolvedActions,
    IReadOnlyList<CheckInSummaryDto> CompletedHistory);

/// <summary>The employee's own check-in and follow-up surface.</summary>
public sealed record EmployeeCheckInsDto(
    IReadOnlyList<CheckInSummaryDto> Upcoming,
    IReadOnlyList<CheckInDetailDto> Completed,
    IReadOnlyList<FollowUpActionDto> AssignedActions,
    IReadOnlyList<FollowUpActionDto> CompletedActions,
    IReadOnlyList<DiscussionSignalDto> OpenDiscussionSignals);
