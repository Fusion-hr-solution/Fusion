namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Lifecycle state of a performance cycle. Transitions are one-directional:
/// Draft -> Published -> Active -> Closed.
/// </summary>
public enum PerformanceCycleStatus
{
    Draft,
    Published,
    Active,
    Closed
}
