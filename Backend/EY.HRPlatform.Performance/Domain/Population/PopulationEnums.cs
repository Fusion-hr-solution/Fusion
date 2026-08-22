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

    /// <summary>No accountable manager resolves for the employee. Soft.</summary>
    MissingManager = 2,
}

public static class ReadinessIssue
{
    public static bool IsHard(ReadinessIssueCode code)
        => code is ReadinessIssueCode.InactiveEmployment or ReadinessIssueCode.NoPrimaryAssignment;
}
