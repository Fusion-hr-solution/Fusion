namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Three-state lifecycle for feedback responses per D-13:
/// Draft → Submitted → Locked.
/// </summary>
public enum FeedbackResponseStatus
{
    Draft,
    Submitted,
    Locked
}
