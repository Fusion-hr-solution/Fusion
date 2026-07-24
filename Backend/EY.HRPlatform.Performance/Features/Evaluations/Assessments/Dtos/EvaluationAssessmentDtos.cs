namespace EY.HRPlatform.Performance.Features.Evaluations.Assessments.Dtos;

// ─── Shared frozen scale projections ─────────────────────────────────────────

public sealed record AssessmentScaleLevelDto(int Ordinal, string Label, string? Description);
public sealed record AssessmentProficiencyLevelDto(int Ordinal, string Label, string? Description);

// ─── My evaluations (employee list) ──────────────────────────────────────────

public sealed record MyEvaluationListItemDto(
    Guid RoundId,
    string RoundName,
    string RoundType,
    string Status,
    string NextAction,
    DateTime? Deadline,
    DateTime? FinalizedAt,
    DateTime? AcknowledgedAt,
    decimal? FinalScore,
    int? FinalRatingOrdinal,
    string? FinalRatingLabel);

// ─── Result surface (post-finalization) ──────────────────────────────────────

public sealed record EvaluationResultDto(
    int? OverallObjectivesRatingOrdinal,
    string? OverallObjectivesRatingLabel,
    int? OverallSkillsRatingOrdinal,
    string? OverallSkillsRatingLabel,
    decimal? FinalScore,
    int? FinalRatingOrdinal,
    string? FinalRatingLabel,
    string? DiscussionSummary,
    int ObjectivesWeightPercent,
    int SkillsWeightPercent,
    DateTime? FinalizedAt,
    DateTime? AcknowledgedAt,
    string? AcknowledgementComment);

// ─── Authoring workspace (self or manager) ───────────────────────────────────

public sealed record AssessmentObjectiveItemDto(
    Guid ObjectiveSnapshotId, string Title, string? Description, int? Weight, DateTime? Deadline,
    string? MeasurementIndicator, string? TargetValue, string? TargetUnit, string? SuccessCriteria,
    int? MyRatingOrdinal, string? MyComment,
    int? ManagerRatingOrdinal = null, string? ManagerComment = null);

public sealed record AssessmentSkillItemDto(
    Guid SkillSnapshotItemId, Guid SkillId, string SkillName, string CategoryName,
    int ExpectedLevelOrdinal, string? ExpectedLevelLabel,
    int? MyProficiencyOrdinal, string? MyComment,
    int? ManagerProficiencyOrdinal = null, string? ManagerComment = null);

public sealed record AssessmentQuestionItemDto(
    Guid QuestionSnapshotId, string Prompt, string Type, bool IsRequired, bool AllowNotApplicable,
    string? MyTextAnswer, int? MyRatingOrdinal, bool IsNotApplicable, string? NotApplicableReason);

public sealed record AssessmentWorkspaceDto(
    Guid AssignmentId,
    Guid RoundId,
    string RoundName,
    string Kind,
    string Status,
    bool Editable,
    bool IncludesObjectives,
    bool IncludesSkills,
    int ObjectivesWeightPercent,
    int SkillsWeightPercent,
    DateTime? Deadline,
    IReadOnlyList<AssessmentScaleLevelDto> PerformanceScale,
    IReadOnlyList<AssessmentProficiencyLevelDto> ProficiencyScale,
    IReadOnlyList<AssessmentObjectiveItemDto> Objectives,
    IReadOnlyList<AssessmentSkillItemDto> Skills,
    IReadOnlyList<AssessmentQuestionItemDto> Questions,
    EvaluationResultDto? Result,
    Guid? ManagerAssignmentId);

// ─── Team queue (manager list) ───────────────────────────────────────────────

public sealed record TeamQueueItemDto(
    Guid ParticipantEmployeeId,
    string ParticipantName,
    Guid? SelfAssignmentId,
    Guid ManagerAssignmentId,
    string Status,
    bool Actionable,
    bool SelfSubmitted,
    bool SelfMissing,
    int MaterialDifferenceCount,
    DateTime? Deadline,
    DateTime? FinalizedAt,
    DateTime? AcknowledgedAt,
    string NextAction);

public sealed record TeamQueueDto(
    Guid RoundId, string RoundName, string AssessmentModel, IReadOnlyList<TeamQueueItemDto> Items);

// ─── Participant (manager) comparison workspace ──────────────────────────────

public sealed record ComparisonObjectiveDto(
    Guid ObjectiveSnapshotId, string Title, string? Description, int? Weight,
    string? MeasurementIndicator, string? TargetValue, string? TargetUnit, string? SuccessCriteria,
    int? SelfRatingOrdinal, string? SelfComment,
    int? ManagerRatingOrdinal, string? ManagerComment,
    bool MaterialDifference);

public sealed record ComparisonSkillDto(
    Guid SkillSnapshotItemId, Guid SkillId, string SkillName, string CategoryName,
    int ExpectedLevelOrdinal, string? ExpectedLevelLabel,
    int? SelfProficiencyOrdinal, string? SelfComment,
    int? ManagerProficiencyOrdinal, string? ManagerComment,
    int? ManagerGap, string? GapState,
    bool MaterialDifference);

public sealed record ComparisonQuestionDto(
    Guid QuestionSnapshotId, string Prompt, string Type, string TargetRater,
    bool IsRequired, bool AllowNotApplicable,
    string? SelfTextAnswer, int? SelfRatingOrdinal, bool SelfNotApplicable,
    string? ManagerTextAnswer, int? ManagerRatingOrdinal, bool ManagerNotApplicable);

public sealed record ParticipantWorkspaceDto(
    Guid RoundId,
    string RoundName,
    Guid ParticipantEmployeeId,
    string ParticipantName,
    Guid? SelfAssignmentId,
    Guid ManagerAssignmentId,
    string ManagerStatus,
    bool Actionable,
    bool SelfSubmitted,
    bool SelfMissing,
    bool IncludesObjectives,
    bool IncludesSkills,
    int ObjectivesWeightPercent,
    int SkillsWeightPercent,
    DateTime? ManagerDeadline,
    DateTime? FinalizationDeadline,
    IReadOnlyList<AssessmentScaleLevelDto> PerformanceScale,
    IReadOnlyList<AssessmentProficiencyLevelDto> ProficiencyScale,
    IReadOnlyList<ComparisonObjectiveDto> Objectives,
    IReadOnlyList<ComparisonSkillDto> Skills,
    IReadOnlyList<ComparisonQuestionDto> Questions,
    decimal? MeanManagerObjectiveRating,
    int SkillsBelowExpectation,
    int SkillsMeetsExpectation,
    int SkillsExceedsExpectation,
    EvaluationResultDto? Result,
    uint Version);

// ─── HR completion band ──────────────────────────────────────────────────────

public sealed record RoundCompletionDto(
    Guid RoundId,
    string RoundName,
    string AssessmentModel,
    int ParticipantCount,
    int SelfNotStarted,
    int SelfInProgress,
    int SelfSubmitted,
    int ManagerNotStarted,
    int ManagerInProgress,
    int ManagerSubmitted,
    int Finalized,
    int Acknowledged,
    int OverdueSelf,
    int OverdueManager,
    int OverdueFinalization);
