using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The frozen launch-snapshot content an <see cref="EvaluationAssignment"/> validates
/// its responses against. Built by the caller from the round's immutable snapshots so
/// the aggregate never resolves live configuration, Core data, or reviewer assignments.
/// </summary>
public sealed record EvaluationAssessmentSnapshot(
    bool IncludesObjectives,
    bool IncludesSkills,
    IReadOnlyCollection<Guid> ObjectiveSnapshotIds,
    IReadOnlyCollection<Guid> SkillItemIds,
    IReadOnlyCollection<EvaluationAssessmentQuestion> Questions,
    IReadOnlyCollection<int> PerformanceScaleOrdinals,
    IReadOnlyCollection<int> ProficiencyScaleOrdinals);

/// <summary>A frozen template question, projected for assessment validation.</summary>
public sealed record EvaluationAssessmentQuestion(
    Guid Id,
    EvaluationQuestionType Type,
    bool IsRequired,
    EvaluationTargetRater TargetRater,
    bool AllowNotApplicable);

/// <summary>An idempotent draft upsert of an assignment's responses.</summary>
public sealed record EvaluationAssessmentDraftInput(
    IReadOnlyCollection<EvaluationObjectiveRatingInput> ObjectiveRatings,
    IReadOnlyCollection<EvaluationSkillRatingInput> SkillRatings,
    IReadOnlyCollection<EvaluationQuestionAnswerInput> QuestionAnswers)
{
    public static EvaluationAssessmentDraftInput Empty { get; } =
        new([], [], []);
}

public sealed record EvaluationObjectiveRatingInput(
    Guid ObjectiveSnapshotId,
    int? RatingOrdinal,
    string? Comment);

public sealed record EvaluationSkillRatingInput(
    Guid SkillSnapshotItemId,
    int? ProficiencyOrdinal,
    string? Comment);

public sealed record EvaluationQuestionAnswerInput(
    Guid QuestionSnapshotId,
    string? TextAnswer,
    int? RatingOrdinal,
    bool IsNotApplicable,
    string? NotApplicableReason);

/// <summary>Manager area ratings + discussion summary recorded at finalization.</summary>
public sealed record EvaluationFinalizationInput(
    int? OverallObjectivesRatingOrdinal,
    int? OverallSkillsRatingOrdinal,
    string DiscussionSummary);

public enum EvaluationAssessmentItemKind
{
    Objective,
    Skill,
    Question
}

/// <summary>A single frozen item a submission is missing, for completeness feedback.</summary>
public sealed record EvaluationAssessmentIncompleteItem(
    EvaluationAssessmentItemKind Kind,
    Guid Id);
