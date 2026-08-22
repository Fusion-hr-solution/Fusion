namespace EY.HRPlatform.Performance.Domain.Plans;

/// <summary>
/// The lifecycle of one employee plan. Authoring happens in <see cref="Draft"/>; the whole plan
/// is submitted once (<see cref="Submitted"/>); the responsible manager approves it, which locks
/// the expectation baseline (<see cref="Approved"/>). A return sends it back to Draft. Approval is
/// exactly one final event — normal manager approval or an exceptional administrative one, never
/// both (product-spec §14/§15).
/// </summary>
public enum PlanLifecycleState
{
    Draft = 0,
    Submitted = 1,
    Approved = 2,
}

/// <summary>
/// One attributable step in a plan's agreement history: submitted by the employee, returned by the
/// manager with required feedback, approved by the responsible manager, or approved exceptionally by
/// tenant administration when the normal approver is blocked. The exceptional kind is recorded and
/// attributed distinctly and never pretends the manager approved (product-spec §15).
/// </summary>
public enum PlanDecisionKind
{
    Submitted = 0,
    Returned = 1,
    Approved = 2,
    ApprovedExceptionally = 3,
}

/// <summary>How a plan reached its single final approval — the normal manager path or the governed escape hatch.</summary>
public enum PlanApprovalKind
{
    Normal = 0,
    Exceptional = 1,
}
