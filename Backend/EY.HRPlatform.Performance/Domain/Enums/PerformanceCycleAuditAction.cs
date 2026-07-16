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
    Closed,
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

    // Strategic objective actions (Plan 03-02)
    StrategicObjectivePublished,
    StrategicObjectiveSuperseded,

    // Collective objective actions (Plan 03-03)
    CollectiveObjectiveApprovalRouted,
    CollectiveObjectiveAutoApproved,

    // Progress tracking actions (Plan 03-04)
    ObjectiveProgressCorrected,

    // Feedback-specific actions (Plan 04-01, D-19)
    FeedbackResponseSubmitted,
    FeedbackResponseWithdrawn,
    FeedbackResponseLocked,
    FeedbackThresholdReached,
    FeedbackSuppressed,
    FeedbackContentAccessed,
    FeedbackIdentityAccessed,
    FeedbackResponseInvalidated,

    // Exception case actions (Phase 05)
    ExceptionOpened,
    ExceptionOwnershipTransferred,
    ExceptionReassigned,
    ExceptionOverridden,
    ExceptionReturned,
    ExceptionCancelled,
    ExceptionForceClosed
}
