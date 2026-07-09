namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Lifecycle state of a performance campaign. The lean P1.2 launch path is a single
/// transition: Draft -> Launched. Active/Closed remain for the deferred in-flight lifecycle
/// (objective planning, close) and are not reached by the launch path.
/// </summary>
public enum PerformanceCycleStatus
{
    Draft,
    Launched,
    Active,
    Closed
}
