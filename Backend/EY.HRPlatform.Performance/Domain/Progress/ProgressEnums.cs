namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>
/// The measurement change one progress check-in carries, matched to the objective's method: a new manual
/// percentage, a new numeric current actual, a set of milestones completed or reopened, or none at all when
/// the owner reports status alone. Append-only — the latest check-in determines current state.
/// </summary>
public enum ProgressEventKind
{
    PercentageSet = 0,
    NumericActual = 1,
    MilestonesChanged = 2,
    StatusOnly = 4,
}

/// <summary>How the owner says an objective is going (D-05). Reported with each check-in, never inferred.</summary>
public enum ObjectiveStatus
{
    OnTrack = 0,
    AtRisk = 1,
    OffTrack = 2,
}

public static class ObjectiveStatuses
{
    /// <summary>At risk and Off track: they need a reason and ask for the reviewer's attention.</summary>
    public static bool IsRisky(ObjectiveStatus? status) => status is ObjectiveStatus.AtRisk or ObjectiveStatus.OffTrack;
}

/// <summary>The three supported evidence kinds attached to a progress update (product-spec §29).</summary>
public enum EvidenceKind
{
    File = 0,
    Link = 1,
    Reference = 2,
}
