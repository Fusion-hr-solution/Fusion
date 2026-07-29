namespace EY.HRPlatform.Interview.Domain;

/// <summary>
/// Reviewer-facing severity for proctoring signals, so the surface can roll up an attempt to a
/// single "how concerning is this" level instead of dumping a firehose of raw events. Single source
/// of truth for both the per-type label and the attempt roll-up.
/// </summary>
public static class ProctoringSeverity
{
    public const string None = "none";
    public const string Low = "low";
    public const string Medium = "medium";
    public const string High = "high";

    /// <summary>A heartbeat gap beyond this (seconds) means the monitor "went dark" during the
    /// attempt (camera/tab closed, network cut). The client beats ~every 10s.</summary>
    public const int HeartbeatGapThresholdSeconds = 45;

    public static string ForType(string type) => type switch
    {
        // Strongest integrity signals.
        ProctoringEventTypes.SecondPerson or ProctoringEventTypes.ProhibitedObject => High,
        // Meaningful but individually weaker / more false-positive prone.
        ProctoringEventTypes.CandidateAbsent
            or ProctoringEventTypes.LookingAway
            or ProctoringEventTypes.CameraDenied
            or ProctoringEventTypes.CameraLost => Medium,
        // Browser-integrity noise floor (tab/fullscreen/second-display/clipboard).
        _ => Low,
    };

    public static int Rank(string severity) => severity switch
    {
        High => 3,
        Medium => 2,
        Low => 1,
        _ => 0,
    };

    /// <summary>The highest severity present, or "none" for an empty set.</summary>
    public static string RollUp(IEnumerable<string> severities)
    {
        var top = None;
        foreach (var severity in severities)
        {
            if (Rank(severity) > Rank(top))
            {
                top = severity;
            }
        }
        return top;
    }
}
