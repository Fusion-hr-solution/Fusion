using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;

namespace EY.HRPlatform.Performance.Features.CheckIns;

/// <summary>Maps check-in aggregates to read DTOs, deriving overdue from the current time.</summary>
public static class CheckInMapper
{
    public static bool IsCheckInOverdue(PerformanceCheckIn checkIn, DateTime now)
        => checkIn.Status == CheckInStatus.Planned && checkIn.PlannedDate.Date < now.Date;

    public static bool IsActionOverdue(CheckInFollowUpAction action, DateTime now)
        => action.Status == FollowUpActionStatus.Open && action.DueDate.Date < now.Date;

    public static CheckInSummaryDto ToSummary(PerformanceCheckIn checkIn, DateTime now)
        => new(
            checkIn.Id,
            checkIn.CycleId,
            checkIn.Status,
            checkIn.PlannedDate,
            checkIn.PlannedTime,
            checkIn.Reason,
            IsCheckInOverdue(checkIn, now),
            checkIn.LinkedObjectives.Count,
            checkIn.CreatedByReviewerName,
            checkIn.CompletedAt,
            checkIn.Response is not null,
            checkIn.Version);

    public static CheckInDetailDto ToDetail(
        PerformanceCheckIn checkIn,
        string employeeName,
        IReadOnlyList<CheckInFollowUpAction> actions,
        DateTime now)
        => new(
            checkIn.Id,
            checkIn.CycleId,
            checkIn.EmployeeId,
            employeeName,
            checkIn.CreatedByReviewerName,
            checkIn.Status,
            checkIn.PlannedDate,
            checkIn.PlannedTime,
            checkIn.Reason,
            checkIn.Agenda,
            IsCheckInOverdue(checkIn, now),
            checkIn.Version,
            checkIn.CompletionSummary,
            checkIn.CompletedByReviewerName,
            checkIn.CompletedAt,
            checkIn.CancellationReason,
            checkIn.CancelledAt,
            checkIn.LinkedObjectives
                .Select(item => new CheckInLinkedObjectiveDto(item.ObjectiveId, item.ObjectiveTitle, item.WasDiscussed))
                .ToList(),
            checkIn.RescheduleHistory
                .OrderBy(item => item.OccurredAt)
                .Select(item => new CheckInRescheduleEntryDto(
                    item.PreviousDate, item.PreviousTime, item.NewDate, item.NewTime, item.ActorName, item.OccurredAt))
                .ToList(),
            checkIn.Addenda
                .OrderBy(item => item.CreatedAtUtc)
                .Select(item => new CheckInAddendumDto(item.Id, item.AuthorName, item.Text, item.CreatedAtUtc))
                .ToList(),
            checkIn.Response is null ? null : new CheckInResponseDto(checkIn.Response.Text, checkIn.Response.CreatedAtUtc),
            actions.Select(action => ToActionDto(action, now)).ToList());

    public static FollowUpActionDto ToActionDto(CheckInFollowUpAction action, DateTime now)
        => new(
            action.Id,
            action.CheckInId,
            action.Description,
            action.OwnerKind,
            action.OwnerEmployeeId,
            action.OwnerName,
            action.DueDate,
            action.LinkedObjectiveId,
            action.Status,
            IsActionOverdue(action, now),
            action.ResolutionNote,
            action.ResolvedAt,
            action.Version,
            action.StatusEvents
                .OrderBy(item => item.OccurredAt)
                .Select(item => new FollowUpActionStatusEventDto(
                    item.FromStatus, item.ToStatus, item.ActorName, item.Note, item.OccurredAt))
                .ToList());

    public static DiscussionSignalDto ToSignalDto(ObjectiveDiscussionSignal signal)
        => new(
            signal.Id,
            signal.ObjectiveId,
            signal.ObjectiveTitle,
            signal.Note,
            signal.Status,
            signal.LinkedCheckInId,
            signal.ResolvedByCheckInId,
            signal.CloseReason,
            signal.RaisedAt,
            signal.ResolvedAt);
}
