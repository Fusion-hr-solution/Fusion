namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Auditable actions performed against a performance cycle.
/// </summary>
public enum PerformanceCycleAuditAction
{
    Created,
    Updated,
    PopulationUpdated,
    ApproverOverridden,
    CampaignLaunched,
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
    WorkforceDeltaApplied,
    WorkforceDeltaRejected,
    PlanningRulesSnapshotCaptured,
    StrategicObjectiveAdded,
    StrategicObjectiveUpdated,
    StrategicObjectiveToggled,

    // Team objective actions (P1.3)
    TeamObjectiveCreated,
    TeamObjectiveUpdated,
    TeamObjectiveDeleted,

    // Employee objective plan actions (P1.4)
    EmployeeObjectivePlanCreated,
    EmployeeObjectiveCreated,
    EmployeeObjectiveUpdated,
    EmployeeObjectiveDeleted,
    EmployeeObjectivePlanSubmitted,
    EmployeeObjectivePlanResubmitted,
    EmployeeObjectivePlanChangesRequested,
    EmployeeObjectivePlanApproved,

    // Planning completion and lock actions (P1.6)
    PlanningReminderRecorded,
    PlanningReminderTriggered,
    PlanningApproverReassigned,
    PlanningParticipantExcluded,
    PlanningLockRejected,
    PlanningLocked,

    // Strategic objective actions (Plan 03-02)
    StrategicObjectivePublished,
    StrategicObjectiveSuperseded,

    // Employee objective actions (Plan 03-03)
    CollectiveObjectiveApprovalRouted,
    CollectiveObjectiveAutoApproved,

    // Progress tracking actions (Plan 03-04)
    ObjectiveProgressCorrected
}
