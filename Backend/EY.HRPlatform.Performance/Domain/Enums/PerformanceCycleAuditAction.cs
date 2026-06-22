namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Auditable actions performed against a performance cycle.
/// </summary>
public enum PerformanceCycleAuditAction
{
    Created,
    Updated,
    PopulationUpdated,
    GovernanceConfigured,
    GovernanceFrozen,
    ReviewDefinitionConfigured,
    ReviewSubmitted,
    ManagerReviewFinalized,
    ReviewCorrectionRequested,
    ResponsibilityCurated,
    ReadyToLaunch,
    AssignmentPreparationStarted,
    Activated,
    Closed,
    WorkforceDeltaApplied,
    WorkforceDeltaRejected,

    // Strategic objective actions (Plan 03-02)
    StrategicObjectivePublished,
    StrategicObjectiveSuperseded,

    // Collective objective actions (Plan 03-03)
    CollectiveObjectiveApprovalRouted,
    CollectiveObjectiveAutoApproved,

    // Progress tracking actions (Plan 03-04)
    ObjectiveProgressCorrected
}
