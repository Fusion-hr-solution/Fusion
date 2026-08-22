using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Plans;

/// <summary>
/// The facts about a plan's authored objectives that the submission gate needs but that live on the
/// objective rows rather than the plan aggregate. The command layer computes them from the loaded
/// objectives and passes them in, so the aggregate enforces the whole-plan invariants in one place
/// without reaching across aggregates itself (the same pattern as the contribution-baseline lock).
/// </summary>
public sealed record PlanSubmissionFacts(
    int ObjectiveCount,
    bool EveryObjectiveHasWeight,
    decimal WeightTotal,
    bool ConnectsToStrategicDirection,
    bool HasStandaloneObjective,
    bool StandaloneAllowed);

/// <summary>
/// An employee's own weighted objective plan within one Cycle. The employee authors the objectives
/// and weights (Draft), submits the whole plan once, and the responsible manager returns it with
/// feedback or approves it, which locks the expectation baseline. A participant holds at most one
/// plan per Cycle (invariant plus a unique constraint). The plan objectives themselves are
/// <see cref="Objectives.Objective"/> rows in Employee scope carrying this plan's id and a plan
/// weight; this aggregate owns the lifecycle, the agreement trail, and the whole-plan invariants.
/// </summary>
public sealed class EmployeePlan : PerformanceAggregate
{
    private readonly List<PlanDecision> _decisions = [];

    private EmployeePlan() { }

    public Guid CycleId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string EmployeeDisplayName { get; private set; } = string.Empty;
    public string? OrgUnitName { get; private set; }

    /// <summary>The responsible manager captured for this Cycle, who reviews and approves the plan.</summary>
    public Guid? ResponsibleManagerId { get; private set; }
    public string? ResponsibleManagerName { get; private set; }

    public PlanLifecycleState State { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? ApprovedAt { get; private set; }

    /// <summary>Whether the single final approval was the normal manager path or the governed escape hatch.</summary>
    public PlanApprovalKind? ApprovalKind { get; private set; }

    /// <summary>Who recorded the final approval — the manager, or the administrator for an exceptional approval.</summary>
    public Guid? ApprovedByEmployeeId { get; private set; }

    public IReadOnlyList<PlanDecision> Decisions => _decisions;

    public bool IsLocked => State == PlanLifecycleState.Approved;

    public static EmployeePlan Create(
        Guid tenantId,
        Guid cycleId,
        Guid participantId,
        Guid employeeId,
        string employeeDisplayName,
        string? orgUnitName,
        Guid? responsibleManagerId,
        string? responsibleManagerName)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (cycleId == Guid.Empty) throw new ArgumentException("CycleId is required.", nameof(cycleId));
        if (participantId == Guid.Empty) throw new ArgumentException("A plan belongs to a Cycle participant.", nameof(participantId));
        if (employeeId == Guid.Empty) throw new ArgumentException("A plan belongs to an employee.", nameof(employeeId));

        return new EmployeePlan
        {
            TenantId = tenantId,
            CycleId = cycleId,
            ParticipantId = participantId,
            EmployeeId = employeeId,
            EmployeeDisplayName = employeeDisplayName,
            OrgUnitName = Normalize(orgUnitName),
            ResponsibleManagerId = responsibleManagerId == Guid.Empty ? null : responsibleManagerId,
            ResponsibleManagerName = Normalize(responsibleManagerName),
            State = PlanLifecycleState.Draft,
        };
    }

    /// <summary>Submits the whole Draft plan for the responsible manager's decision once it is ready.</summary>
    public void Submit(Guid actorEmployeeId, PlanSubmissionFacts facts)
    {
        if (State != PlanLifecycleState.Draft)
            throw new InvalidOperationException("Only a Draft plan can be submitted.");
        if (actorEmployeeId != EmployeeId)
            throw new InvalidOperationException("Only the plan's own employee can submit it.");

        if (facts.ObjectiveCount == 0)
            throw new InvalidOperationException("Add at least one objective before submitting.");
        if (!facts.EveryObjectiveHasWeight)
            throw new InvalidOperationException("Every objective needs a plan weight before submitting.");
        if (facts.WeightTotal != 100m)
            throw new InvalidOperationException("Plan weights must total exactly 100% before submitting.");
        if (!facts.ConnectsToStrategicDirection)
            throw new InvalidOperationException("At least one objective must connect to strategic direction.");
        if (facts.HasStandaloneObjective && !facts.StandaloneAllowed)
            throw new InvalidOperationException("Standalone objectives are not permitted; align every objective to direction.");

        State = PlanLifecycleState.Submitted;
        SubmittedAt = DateTime.UtcNow;
        RecordDecision(PlanDecisionKind.Submitted, actorEmployeeId, null);
        MarkUpdated();
    }

    /// <summary>Returns a Submitted plan to Draft with required feedback, performed by the responsible manager.</summary>
    public void Return(Guid actorEmployeeId, string feedback)
    {
        if (State != PlanLifecycleState.Submitted)
            throw new InvalidOperationException("Only a Submitted plan can be returned.");
        if (string.IsNullOrWhiteSpace(feedback))
            throw new ArgumentException("Returning a plan requires feedback.", nameof(feedback));

        State = PlanLifecycleState.Draft;
        SubmittedAt = null;
        RecordDecision(PlanDecisionKind.Returned, actorEmployeeId, feedback);
        MarkUpdated();
    }

    /// <summary>Approves a Submitted plan through the normal manager path, locking the expectation baseline.</summary>
    public void Approve(Guid managerEmployeeId)
    {
        if (State != PlanLifecycleState.Submitted)
            throw new InvalidOperationException("Only a Submitted plan can be approved.");

        State = PlanLifecycleState.Approved;
        ApprovedAt = DateTime.UtcNow;
        ApprovalKind = PlanApprovalKind.Normal;
        ApprovedByEmployeeId = managerEmployeeId;
        RecordDecision(PlanDecisionKind.Approved, managerEmployeeId, null);
        MarkUpdated();
    }

    /// <summary>
    /// Approves a Submitted plan through the governed administrative escape hatch when the normal
    /// approver is blocked. Requires a recorded reason, is attributed to the administrator, and
    /// preserves the responsible-manager identity separately — it never pretends the manager approved.
    /// </summary>
    public void ApproveExceptionally(Guid administratorEmployeeId, string reason)
    {
        if (State != PlanLifecycleState.Submitted)
            throw new InvalidOperationException("Only a Submitted plan can be exceptionally approved.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("An exceptional approval requires a recorded reason.", nameof(reason));

        State = PlanLifecycleState.Approved;
        ApprovedAt = DateTime.UtcNow;
        ApprovalKind = PlanApprovalKind.Exceptional;
        ApprovedByEmployeeId = administratorEmployeeId;
        RecordDecision(PlanDecisionKind.ApprovedExceptionally, administratorEmployeeId, reason);
        MarkUpdated();
    }

    private void RecordDecision(PlanDecisionKind kind, Guid actorEmployeeId, string? feedback)
    {
        var decision = PlanDecision.Record(TenantId, kind, actorEmployeeId, feedback);
        decision.AttachTo(Id);
        _decisions.Add(decision);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
