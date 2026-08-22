using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Cycles;

/// <summary>
/// A Performance Cycle: the container for one planning-and-progress horizon. Defined by name,
/// dates, and planning deadline (never a hard-coded type). Formal lifecycle Draft → Active →
/// Closed with at most one Active per tenant (enforced by the application + a filtered unique
/// index). Activation freezes an <see cref="ActivationSnapshot"/> and opens planning.
/// </summary>
public sealed class PerformanceCycle : PerformanceAggregate
{
    private PerformanceCycle() { }

    public string Name { get; private set; } = string.Empty;
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public DateOnly PlanningDeadline { get; private set; }
    public CycleLifecycleState State { get; private set; }
    public DateTime? ActivatedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    public ActivationSnapshot? ActivationSnapshot { get; private set; }

    /// <summary>
    /// Marks the filtered-unique "one Active per tenant" slot. Null for Draft/Closed, equal to
    /// TenantId while Active — so the database can enforce single-Active without a race.
    /// </summary>
    public Guid? ActiveTenantSlot { get; private set; }

    public static PerformanceCycle CreateDraft(
        Guid tenantId,
        string name,
        DateOnly startDate,
        DateOnly endDate,
        DateOnly planningDeadline)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("A Cycle requires a name.", nameof(name));

        ValidateDates(startDate, endDate, planningDeadline);

        return new PerformanceCycle
        {
            TenantId = tenantId,
            Name = name.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            PlanningDeadline = planningDeadline,
            State = CycleLifecycleState.Draft,
        };
    }

    public void UpdateDraftDetails(string name, DateOnly startDate, DateOnly endDate, DateOnly planningDeadline)
    {
        RequireDraft();
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("A Cycle requires a name.", nameof(name));
        ValidateDates(startDate, endDate, planningDeadline);

        Name = name.Trim();
        StartDate = startDate;
        EndDate = endDate;
        PlanningDeadline = planningDeadline;
        MarkUpdated();
    }

    /// <summary>Whether the Cycle's own dates form a valid, activatable range.</summary>
    public bool HasValidDates => EndDate > StartDate
        && PlanningDeadline >= StartDate
        && PlanningDeadline <= EndDate;

    /// <summary>
    /// Activates a Draft Cycle, capturing its activation snapshot. The caller is responsible
    /// for the cross-aggregate blockers (no other Active Cycle, published strategy, confirmed
    /// non-empty population); this method enforces the Cycle-local preconditions and the
    /// single-Active database slot.
    /// </summary>
    public void Activate(ActivationSnapshot snapshot)
    {
        RequireDraft();
        ArgumentNullException.ThrowIfNull(snapshot);
        if (!HasValidDates)
            throw new InvalidOperationException("A Cycle with invalid dates cannot be activated.");

        ActivationSnapshot = snapshot;
        State = CycleLifecycleState.Active;
        ActivatedAt = DateTime.UtcNow;
        ActiveTenantSlot = TenantId;
        MarkUpdated();
    }

    public void Close()
    {
        if (State != CycleLifecycleState.Active)
            throw new InvalidOperationException("Only an Active Cycle can be closed.");

        State = CycleLifecycleState.Closed;
        ClosedAt = DateTime.UtcNow;
        ActiveTenantSlot = null;
        MarkUpdated();
    }

    public bool IsDraft => State == CycleLifecycleState.Draft;
    public bool IsActive => State == CycleLifecycleState.Active;
    public bool IsClosed => State == CycleLifecycleState.Closed;

    private void RequireDraft()
    {
        if (State != CycleLifecycleState.Draft)
            throw new InvalidOperationException("Only a Draft Cycle can be edited or activated.");
    }

    private static void ValidateDates(DateOnly startDate, DateOnly endDate, DateOnly planningDeadline)
    {
        if (endDate <= startDate)
            throw new ArgumentException("A Cycle's end date must be after its start date.", nameof(endDate));
        if (planningDeadline < startDate || planningDeadline > endDate)
            throw new ArgumentException("The planning deadline must fall within the Cycle's dates.", nameof(planningDeadline));
    }
}
