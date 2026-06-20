namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Lifecycle state of a governed performance campaign. Transitions are one-directional:
/// Draft -> AssignmentPreparation -> ReadyToLaunch -> Active -> Closed.
/// </summary>
public enum PerformanceCycleStatus
{
    Draft,
    AssignmentPreparation,
    ReadyToLaunch,
    Active,
    Closed,

    /// <summary>
    /// Read-compatible alias for rows/API clients written before Packet A.
    /// New workflow code must use <see cref="AssignmentPreparation"/>.
    /// </summary>
    Published = AssignmentPreparation
}
