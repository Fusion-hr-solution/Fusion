using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Events;

/// <summary>
/// Raised when an employee objective plan is submitted (or resubmitted) for approval.
/// Fans out to activity + notification handlers without the submit command referencing them.
/// </summary>
public sealed record EmployeeObjectivePlanSubmittedEvent(
    Guid TenantId,
    Guid PlanId,
    Guid CycleId,
    Guid EmployeeId,
    string EmployeeName,
    Guid? ApproverEmployeeId,
    bool WasResubmission) : DomainEventBase;

/// <summary>
/// Raised when a manager approves an employee objective plan.
/// </summary>
public sealed record EmployeeObjectivePlanApprovedEvent(
    Guid TenantId,
    Guid PlanId,
    Guid CycleId,
    Guid EmployeeId,
    Guid ApprovingManagerEmployeeId,
    string ApprovingManagerName) : DomainEventBase;

/// <summary>
/// Raised for every recorded objective progress update; fans out to the activity log.
/// </summary>
public sealed record ObjectiveProgressRecordedEvent(
    Guid TenantId,
    Guid CycleId,
    Guid PlanId,
    Guid ObjectiveId,
    Guid UpdateId,
    Guid EmployeeId,
    string EmployeeName,
    string ObjectiveTitle,
    Guid ActorUserId,
    int? PreviousPercent,
    int NewPercent,
    bool IsRegression) : DomainEventBase;

/// <summary>
/// Raised when an objective's latest progress reaches 100% (derived completion);
/// notifies the participant's effective reviewer.
/// </summary>
public sealed record ObjectiveProgressCompletedEvent(
    Guid TenantId,
    Guid CycleId,
    Guid PlanId,
    Guid ObjectiveId,
    Guid EmployeeId,
    string EmployeeName,
    string ObjectiveTitle) : DomainEventBase;

/// <summary>
/// Raised when a confirmed lower update reopens a completed objective;
/// notifies the participant's effective reviewer.
/// </summary>
public sealed record ObjectiveProgressReopenedEvent(
    Guid TenantId,
    Guid CycleId,
    Guid PlanId,
    Guid ObjectiveId,
    Guid EmployeeId,
    string EmployeeName,
    string ObjectiveTitle,
    int NewPercent,
    string RegressionReason) : DomainEventBase;
