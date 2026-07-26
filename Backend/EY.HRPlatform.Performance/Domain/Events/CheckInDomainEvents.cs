using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Events;

/// <summary>
/// Raised when a reviewer plans a check-in for a participant. Fans out to the activity log and to
/// an employee notification without the planning command referencing those handlers.
/// </summary>
public sealed record CheckInPlannedEvent(
    Guid TenantId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid ReviewerId,
    string ReviewerName,
    DateTime PlannedDate) : DomainEventBase;

/// <summary>Raised when a Planned check-in is rescheduled to a new date/time.</summary>
public sealed record CheckInRescheduledEvent(
    Guid TenantId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid ReviewerId,
    string ReviewerName,
    DateTime PreviousDate,
    DateTime NewDate) : DomainEventBase;

/// <summary>Raised when a Planned check-in is cancelled with a reason.</summary>
public sealed record CheckInCancelledEvent(
    Guid TenantId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid ReviewerId,
    string ReviewerName,
    string Reason) : DomainEventBase;

/// <summary>Raised when a Planned check-in is completed with a shared summary.</summary>
public sealed record CheckInCompletedEvent(
    Guid TenantId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid CompletedByReviewerId,
    string CompletedByReviewerName) : DomainEventBase;

/// <summary>Raised when a traced correction addendum is appended to a Completed check-in.</summary>
public sealed record CheckInAddendumAddedEvent(
    Guid TenantId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid AuthorReviewerId,
    string AuthorName) : DomainEventBase;

/// <summary>Raised when the employee adds their single immutable response to a Completed check-in.</summary>
public sealed record CheckInResponseAddedEvent(
    Guid TenantId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    string EmployeeName) : DomainEventBase;

/// <summary>Raised for every agreed follow-up action created at check-in completion.</summary>
public sealed record FollowUpActionCreatedEvent(
    Guid TenantId,
    Guid ActionId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    FollowUpActionOwnerKind OwnerKind,
    Guid OwnerEmployeeId,
    string OwnerName,
    string Description,
    DateTime DueDate) : DomainEventBase;

/// <summary>Raised when a follow-up action's owner completes it.</summary>
public sealed record FollowUpActionCompletedEvent(
    Guid TenantId,
    Guid ActionId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid OwnerEmployeeId,
    string ActorName) : DomainEventBase;

/// <summary>Raised when a reviewer cancels a follow-up action with a reason.</summary>
public sealed record FollowUpActionCancelledEvent(
    Guid TenantId,
    Guid ActionId,
    Guid CheckInId,
    Guid CycleId,
    Guid EmployeeId,
    Guid ReviewerId,
    string ReviewerName,
    string Reason) : DomainEventBase;

/// <summary>Raised when an employee raises a `Needs discussion` signal on one of their objectives.</summary>
public sealed record DiscussionSignalRaisedEvent(
    Guid TenantId,
    Guid SignalId,
    Guid CycleId,
    Guid PlanId,
    Guid ObjectiveId,
    Guid EmployeeId,
    string EmployeeName,
    string ObjectiveTitle) : DomainEventBase;

/// <summary>Raised when a discussion signal is resolved by the completion of its linked check-in.</summary>
public sealed record DiscussionSignalResolvedEvent(
    Guid TenantId,
    Guid SignalId,
    Guid CycleId,
    Guid ObjectiveId,
    Guid EmployeeId,
    Guid CheckInId) : DomainEventBase;

/// <summary>Raised when a reviewer closes an open discussion signal with a reason.</summary>
public sealed record DiscussionSignalClosedEvent(
    Guid TenantId,
    Guid SignalId,
    Guid CycleId,
    Guid ObjectiveId,
    Guid EmployeeId,
    Guid ReviewerId,
    string Reason) : DomainEventBase;
