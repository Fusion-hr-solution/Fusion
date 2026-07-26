namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Lifecycle state of a performance campaign. The lean launch path is a single
/// transition: Draft -> Launched. In-flight/close lifecycle is designed later.
/// </summary>
public enum PerformanceCycleStatus
{
    Draft,
    Launched
}
