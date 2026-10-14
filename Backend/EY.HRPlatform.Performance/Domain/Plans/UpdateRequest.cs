using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Objectives;

namespace EY.HRPlatform.Performance.Domain.Plans;

public enum UpdateRequestState { Open = 0, Satisfied = 1, Withdrawn = 2, Unresolved = 3 }

/// <summary>
/// A responsible reviewer's explicit ask that an employee update progress on their Approved plan or on one of
/// its objectives. It never lets the requester edit progress: it resolves through the employee's own update.
/// At most one is Open per target (a filtered unique index on <see cref="TargetKey"/>).
/// </summary>
public sealed class UpdateRequest : PerformanceAggregate
{
    private UpdateRequest() { }

    public Guid CycleId { get; private set; }
    public Guid PlanId { get; private set; }
    public Guid? ObjectiveId { get; private set; }
    /// <summary>The objective when there is one, otherwise the plan.</summary>
    public Guid TargetKey { get; private set; }
    public Guid EmployeeId { get; private set; }
    public Guid RequestedByEmployeeId { get; private set; }
    public string RequestedByName { get; private set; } = string.Empty;
    public DateTime RequestedAt { get; private set; }
    public string? Note { get; private set; }
    public UpdateRequestState State { get; private set; }
    public DateTime? SatisfiedAt { get; private set; }
    public Guid? SatisfiedByProgressUpdateId { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    public static UpdateRequest Create(EmployeePlan plan, Objective? objective, Guid requesterId, string requesterName,
        string? note, DateTime at)
    {
        ArgumentNullException.ThrowIfNull(plan);
        if (plan.State != PlanLifecycleState.Approved)
            throw new InvalidOperationException("Updates can be requested only on an Approved plan.");
        if (requesterId == Guid.Empty || plan.ResponsibleManagerId != requesterId)
            throw new UnauthorizedAccessException("Only the plan's responsible reviewer can request an update.");
        if (objective is not null && (objective.EmployeePlanId != plan.Id || objective.State == ObjectiveLifecycleState.Archived))
            throw new ArgumentException("The objective must be a current objective of this plan.", nameof(objective));
        var cleaned = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (cleaned is { Length: > 500 }) throw new ArgumentException("A note can be up to 500 characters.", nameof(note));
        return new UpdateRequest
        {
            TenantId = plan.TenantId,
            CycleId = plan.CycleId,
            PlanId = plan.Id,
            ObjectiveId = objective?.Id,
            TargetKey = objective?.Id ?? plan.Id,
            EmployeeId = plan.EmployeeId,
            RequestedByEmployeeId = requesterId,
            RequestedByName = string.IsNullOrWhiteSpace(requesterName) ? "Your reviewer" : requesterName.Trim(),
            RequestedAt = at,
            Note = cleaned,
            State = UpdateRequestState.Open,
        };
    }

    /// <summary>Progress recorded after the request satisfies it; earlier progress never does.</summary>
    public bool SatisfyBy(Guid progressUpdateId, DateTime recordedAt)
    {
        if (State != UpdateRequestState.Open || recordedAt <= RequestedAt) return false;
        State = UpdateRequestState.Satisfied;
        SatisfiedAt = recordedAt;
        SatisfiedByProgressUpdateId = progressUpdateId;
        MarkUpdated();
        return true;
    }

    public bool Withdraw(DateTime at)
    {
        if (State == UpdateRequestState.Withdrawn) return false;
        if (State != UpdateRequestState.Open) throw new InvalidOperationException("Only an open request can be withdrawn.");
        State = UpdateRequestState.Withdrawn;
        ClosedAt = at;
        MarkUpdated();
        return true;
    }

    public bool CloseUnresolved(DateTime at)
    {
        if (State != UpdateRequestState.Open) return false;
        State = UpdateRequestState.Unresolved;
        ClosedAt = at;
        MarkUpdated();
        return true;
    }
}
