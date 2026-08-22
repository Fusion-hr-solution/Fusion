namespace EY.HRPlatform.Performance.Domain.Objectives;

/// <summary>
/// Which tier of the organization an objective expresses. One aggregate carries all
/// three; the scope, not a separate entity, distinguishes them (product-spec §8).
/// </summary>
public enum ObjectiveOwnershipScope
{
    Company = 0,
    OrgUnit = 1,
    Employee = 2,
}

/// <summary>
/// Lifecycle of an objective. Strategic objectives use Draft → Published; organizational
/// objectives (Chunk B) add Submitted/Approved; employee objectives live inside the plan
/// lifecycle. Only the states reachable in this change are exercised here.
/// </summary>
public enum ObjectiveLifecycleState
{
    Draft = 0,
    Published = 1,
    Submitted = 2,
    Approved = 3,
}

/// <summary>The three direct measurement methods (performance-objective-measurement).</summary>
public enum MeasurementMethod
{
    ManualPercentage = 0,
    NumericTarget = 1,
    WeightedMilestones = 2,
}

/// <summary>Improvement direction for a numeric-target measurement.</summary>
public enum ImprovementDirection
{
    Increase = 0,
    Decrease = 1,
}

/// <summary>
/// Where an objective's authoritative progress comes from. Strategic and employee objectives are
/// always <see cref="Direct"/>; an organizational objective is Direct or <see cref="Calculated"/>
/// but never both (product-spec §21). Calculated progress rolls up configured contributing
/// children only — alignment and contribution are distinct.
/// </summary>
public enum ObjectiveProgressSource
{
    Direct = 0,
    Calculated = 1,
}

/// <summary>
/// One recorded step in an organizational objective's approval history — submitted for approval,
/// approved by the parent-accountable person, or returned to Draft with feedback. Kept as an
/// attributable trail for the objective context panel (product-spec §17).
/// </summary>
public enum ObjectiveDecisionKind
{
    Submitted = 0,
    Approved = 1,
    Returned = 2,
}
