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
/// Raised when a performance cycle is closed.
/// </summary>
public sealed record PerformanceCycleClosedEvent(
    Guid TenantId,
    Guid CycleId,
    string CycleName) : DomainEventBase;
