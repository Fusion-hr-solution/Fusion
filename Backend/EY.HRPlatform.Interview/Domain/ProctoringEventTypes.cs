namespace EY.HRPlatform.Interview.Domain;

/// <summary>
/// Single source of truth for the proctoring signal types the ingestion endpoint accepts. The
/// client sends the string; ingestion rejects anything not in this set. snake_case matches the
/// client-side signal names. Both browser-integrity (Layer B) and webcam (Layer A) signals live
/// here so one enum feeds one event stream and one reviewer surface.
/// </summary>
public static class ProctoringEventTypes
{
    // Layer B — browser integrity (deterministic; no confidence).
    public const string TabFocusLoss = "tab_focus_loss";
    public const string FullscreenExit = "fullscreen_exit";
    public const string SecondDisplay = "second_display";
    public const string Copy = "copy";
    public const string Cut = "cut";
    public const string Paste = "paste";

    // Layer A — webcam detection (model-based; usually carry a confidence).
    public const string SecondPerson = "second_person";
    public const string CandidateAbsent = "candidate_absent";
    public const string ProhibitedObject = "prohibited_object";
    public const string LookingAway = "looking_away";
    public const string CameraDenied = "camera_denied";
    public const string CameraLost = "camera_lost";

    private static readonly HashSet<string> Allowed = new(StringComparer.Ordinal)
    {
        TabFocusLoss, FullscreenExit, SecondDisplay, Copy, Cut, Paste,
        SecondPerson, CandidateAbsent, ProhibitedObject, LookingAway,
        CameraDenied, CameraLost,
    };

    /// <summary>Max length any valid type string can be — used to size the DB column.</summary>
    public const int MaxTypeLength = 32;

    public static bool IsValid(string? type) => type is not null && Allowed.Contains(type);

    /// <summary>Which author-controlled test flag governs a signal type, so the server can reject
    /// events for a layer the author never enabled (rather than trusting the client to self-limit).
    /// Returns null for an unknown type.</summary>
    public static ProctoringLayer? LayerOf(string? type) => type switch
    {
        TabFocusLoss or FullscreenExit or SecondDisplay => ProctoringLayer.ActivityMonitoring,
        Copy or Cut or Paste => ProctoringLayer.ClipboardRestriction,
        SecondPerson or CandidateAbsent or ProhibitedObject
            or LookingAway or CameraDenied or CameraLost => ProctoringLayer.Webcam,
        _ => null,
    };
}

/// <summary>The three independently-enableable proctoring layers, each mapped to one test flag:
/// ActivityMonitoring → EnableActivityMonitoring, ClipboardRestriction → RestrictCopyPaste,
/// Webcam → EnableProctoring.</summary>
public enum ProctoringLayer
{
    ActivityMonitoring,
    ClipboardRestriction,
    Webcam,
}
