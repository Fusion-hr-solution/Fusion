namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Assignment workflow states. This foundation creates assignments only as NotStarted;
/// the remaining values are reserved for the assessment execution change.
/// </summary>
public enum EvaluationAssignmentStatus
{
    NotStarted,
    InProgress,
    Submitted,
    Finalized
}
