using EY.HRPlatform.Performance.Domain.Population;

namespace EY.HRPlatform.Performance.Features.Population;

/// <summary>
/// One resolved population candidate with its readiness. Eligibility is derived from the Core
/// snapshot as-of the Cycle start date — the frontend never computes this.
/// </summary>
public sealed record PopulationCandidate(
    Guid EmployeeId,
    string DisplayName,
    string? JobTitle,
    Guid? OrgUnitId,
    string? OrgUnitName,
    Guid? ManagerEmployeeId,
    string? ManagerDisplayName,
    bool IsActive,
    bool ByExplicitInclusion,
    bool IsExcluded,
    string? ExclusionReason,
    IReadOnlyList<ReadinessIssueCode> Issues)
{
    /// <summary>No hard readiness issue — may join the confirmed roster.</summary>
    public bool IsEligible => !Issues.Any(ReadinessIssue.IsHard);

    /// <summary>Counts toward the confirmed roster: eligible and not excluded.</summary>
    public bool CountsToRoster => IsEligible && !IsExcluded;
}

/// <summary>The full resolved population for a Cycle: candidates, readiness, and the rule.</summary>
public sealed record PopulationResolution(
    PopulationMode Mode,
    DateOnly EligibilityDate,
    bool IsConfirmed,
    IReadOnlyList<PopulationCandidate> Candidates)
{
    public int ReadyCount => Candidates.Count(candidate => candidate.CountsToRoster);
    public int NeedsAttentionCount => Candidates.Count(candidate => !candidate.IsExcluded && !candidate.IsEligible);
    public int ExcludedCount => Candidates.Count(candidate => candidate.IsExcluded);

    /// <summary>Candidates whose hard issues are neither resolved nor excluded — block activation.</summary>
    public IReadOnlyList<PopulationCandidate> UnresolvedBlockers
        => Candidates.Where(candidate => !candidate.IsExcluded && !candidate.IsEligible).ToList();
}
