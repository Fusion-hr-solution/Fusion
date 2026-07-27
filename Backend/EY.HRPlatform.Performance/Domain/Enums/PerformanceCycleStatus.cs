namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Lifecycle state of a performance campaign: Draft -> Launched -> Closed, terminal.
/// </summary>
/// <remarks>
/// <see cref="Closed"/> is terminal by design (D1). A closed campaign is the system of record for
/// what a person was rated in that period, and downstream readers treat it as settled fact — which
/// only holds if it cannot change underneath them. There is deliberately no reopen transition.
/// </remarks>
public enum PerformanceCycleStatus
{
    Draft,
    Launched,
    Closed
}

/// <summary>Why a campaign closed — recorded so an archive explains itself.</summary>
public enum CampaignClosureKind
{
    /// <summary>Every non-excluded manager assessment reached Finalized.</summary>
    Automatic,

    /// <summary>HR closed the campaign explicitly, possibly with work outstanding.</summary>
    Manual
}
