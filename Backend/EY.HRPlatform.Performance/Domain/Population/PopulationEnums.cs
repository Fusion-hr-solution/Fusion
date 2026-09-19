namespace EY.HRPlatform.Performance.Domain.Population;

/// <summary>How the initial population is resolved from Core Organization truth.</summary>
public enum PopulationMode
{
    /// <summary>All eligible active employees as-of the eligibility date.</summary>
    AllActive = 0,

    /// <summary>Selected organizational units (optionally including descendants).</summary>
    ByScope = 1,
}

/// <summary>
/// A specific readiness problem on a population candidate. Hard issues block a candidate
/// from the confirmed roster unless the administrator excludes them with a reason; soft
/// issues are surfaced with context but do not block.
/// </summary>
public enum ReadinessIssueCode
{
    /// <summary>Employment is not active on the eligibility date. Hard.</summary>
    InactiveEmployment = 0,

    /// <summary>No active primary work assignment on the eligibility date. Hard.</summary>
    NoPrimaryAssignment = 1,

    /// <summary>
    /// No eligible reviewer (accountable manager) resolves for the employee — no manager on
    /// record, or the only manager is the employee themselves (self-review is not a valid
    /// reviewer). Hard — a participant with no reviewer would launch into a Plan no one can
    /// review, so it must be resolved in Core or the person excluded with a reason.
    /// </summary>
    MissingManager = 2,

    /// <summary>
    /// A reviewer resolves, but the manager is not active as-of the eligibility date. Hard for
    /// the same reason as <see cref="MissingManager"/>: an inactive manager cannot own the
    /// participant's review. Resolve in Core (reassign the manager) or exclude with a reason.
    /// </summary>
    InactiveManager = 3,
}

public static class ReadinessIssue
{
    public static bool IsHard(ReadinessIssueCode code)
        => code is ReadinessIssueCode.InactiveEmployment
            or ReadinessIssueCode.NoPrimaryAssignment
            or ReadinessIssueCode.MissingManager
            or ReadinessIssueCode.InactiveManager;

    /// <summary>The reviewer-coverage issues: a participant with either lacks a valid reviewer.</summary>
    public static bool IsReviewerIssue(ReadinessIssueCode code)
        => code is ReadinessIssueCode.MissingManager or ReadinessIssueCode.InactiveManager;
}
