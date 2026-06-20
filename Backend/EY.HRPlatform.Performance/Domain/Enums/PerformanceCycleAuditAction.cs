namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Auditable actions performed against a performance cycle.
/// </summary>
public enum PerformanceCycleAuditAction
{
    Created,
    Updated,
    PopulationUpdated,
    ResponsibilityCurated,
    ReadyToLaunch,
    Published,
    Activated,
    Closed,
    PlanningApproverAssigned
}
