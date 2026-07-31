namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>Read-time state derived from lifecycle, readiness, deadlines, and assignment work.</summary>
public enum EvaluationRoundOperationalState
{
    Draft,
    ReadyToLaunch,
    InProgress,
    Overdue,
    Completed
}
