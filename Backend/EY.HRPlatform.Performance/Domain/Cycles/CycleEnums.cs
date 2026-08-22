namespace EY.HRPlatform.Performance.Domain.Cycles;

/// <summary>The formal Cycle lifecycle. Operational milestones are derived, never states.</summary>
public enum CycleLifecycleState
{
    Draft = 0,
    Active = 1,
    Closed = 2,
}

/// <summary>
/// Operational milestones surfaced for orientation. These are derived from real Cycle state
/// (they are not lifecycle statuses and never replace <see cref="CycleLifecycleState"/>).
/// </summary>
public enum OperationalMilestone
{
    StrategicDirectionPublished = 0,
    PopulationConfirmed = 1,
    PlanningOpened = 2,
    PlanningCompleted = 3,
    PerformanceEndReached = 4,
    ClosureReady = 5,
}
