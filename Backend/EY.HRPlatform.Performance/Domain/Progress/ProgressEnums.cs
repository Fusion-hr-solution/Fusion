namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>
/// The kind of measurement event one progress update records, matched to the objective's method:
/// a new manual percentage, a new numeric current actual, or a milestone completion/reopen
/// (product-spec §27). Append-only — the latest valid event of each kind determines current state.
/// </summary>
public enum ProgressEventKind
{
    PercentageSet = 0,
    NumericActual = 1,
    MilestoneCompleted = 2,
    MilestoneReopened = 3,
}

/// <summary>The three supported evidence kinds attached to a progress update (product-spec §29).</summary>
public enum EvidenceKind
{
    File = 0,
    Link = 1,
    Reference = 2,
}
