using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.CheckIns.Dtos;

// ─── Reviewer command requests ──────────────────────────────────────────────

public sealed record PlanCheckInRequest(
    Guid EmployeeId,
    DateTime PlannedDate,
    string? PlannedTime,
    string Reason,
    string? Agenda,
    IReadOnlyList<Guid>? LinkedObjectiveIds,
    IReadOnlyList<Guid>? DiscussionSignalIds);

public sealed record RescheduleCheckInRequest(
    uint ExpectedVersion,
    DateTime NewDate,
    string? NewTime);

public sealed record CancelCheckInRequest(
    uint ExpectedVersion,
    string Reason);

public sealed record CompleteCheckInRequest(
    uint ExpectedVersion,
    string Summary,
    IReadOnlyList<Guid>? DiscussedObjectiveIds,
    IReadOnlyList<AgreedActionInput>? Actions);

public sealed record AgreedActionInput(
    string Description,
    FollowUpActionOwnerKind OwnerKind,
    DateTime DueDate,
    Guid? LinkedObjectiveId);

public sealed record AddCheckInAddendumRequest(string Text);

// ─── Follow-up action command requests ──────────────────────────────────────

public sealed record CompleteFollowUpActionRequest(uint ExpectedVersion, string? Note);

public sealed record CancelFollowUpActionRequest(uint ExpectedVersion, string Reason);

// ─── Employee command requests ──────────────────────────────────────────────

public sealed record RaiseDiscussionSignalRequest(Guid ObjectiveId, string? Note);

public sealed record CloseDiscussionSignalRequest(string Reason);

public sealed record AddCheckInEmployeeResponseRequest(string Text);

// ─── Compact command results (surfaces refetch the read model afterwards) ────

public sealed record CheckInMutationResult(Guid CheckInId, CheckInStatus Status, uint Version);

public sealed record FollowUpActionMutationResult(Guid ActionId, FollowUpActionStatus Status, uint Version);

public sealed record DiscussionSignalMutationResult(Guid SignalId, DiscussionSignalStatus Status);
