using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// One employee/manager rating of a snapshotted objective, owned by the
/// <see cref="EvaluationAssignment"/> aggregate. The rating ordinal is on the
/// round's frozen performance rating scale. Created and mutated only through
/// the aggregate so the frozen-snapshot and status rules stay enforced.
/// </summary>
public sealed class EvaluationObjectiveRating : BaseEntity, ITenantEntity
{
    public const int CommentMaxLength = 2000;

    private EvaluationObjectiveRating() { }

    public Guid TenantId { get; private set; }
    public Guid AssignmentId { get; private set; }
    public Guid ObjectiveSnapshotId { get; private set; }
    public int? RatingOrdinal { get; private set; }
    public string? Comment { get; private set; }

    internal static EvaluationObjectiveRating Create(
        Guid tenantId,
        Guid assignmentId,
        Guid objectiveSnapshotId,
        int? ratingOrdinal,
        string? comment) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AssignmentId = assignmentId,
            ObjectiveSnapshotId = objectiveSnapshotId,
            RatingOrdinal = ratingOrdinal,
            Comment = comment
        };

    internal void Update(int? ratingOrdinal, string? comment)
    {
        RatingOrdinal = ratingOrdinal;
        Comment = comment;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// One assessed proficiency level for a snapshotted skill item. The proficiency
/// ordinal is on the round's frozen proficiency scale — never the performance
/// rating scale.
/// </summary>
public sealed class EvaluationSkillRating : BaseEntity, ITenantEntity
{
    public const int CommentMaxLength = 2000;

    private EvaluationSkillRating() { }

    public Guid TenantId { get; private set; }
    public Guid AssignmentId { get; private set; }
    public Guid SkillSnapshotItemId { get; private set; }
    public int? ProficiencyOrdinal { get; private set; }
    public string? Comment { get; private set; }

    internal static EvaluationSkillRating Create(
        Guid tenantId,
        Guid assignmentId,
        Guid skillSnapshotItemId,
        int? proficiencyOrdinal,
        string? comment) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AssignmentId = assignmentId,
            SkillSnapshotItemId = skillSnapshotItemId,
            ProficiencyOrdinal = proficiencyOrdinal,
            Comment = comment
        };

    internal void Update(int? proficiencyOrdinal, string? comment)
    {
        ProficiencyOrdinal = proficiencyOrdinal;
        Comment = comment;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// One answer to a snapshotted template question. Text or rating per the frozen
/// question type; <see cref="IsNotApplicable"/> is only accepted where the frozen
/// question allows it, with a reason required on required questions.
/// </summary>
public sealed class EvaluationQuestionAnswer : BaseEntity, ITenantEntity
{
    public const int TextAnswerMaxLength = 4000;
    public const int NotApplicableReasonMaxLength = 300;

    private EvaluationQuestionAnswer() { }

    public Guid TenantId { get; private set; }
    public Guid AssignmentId { get; private set; }
    public Guid QuestionSnapshotId { get; private set; }
    public string? TextAnswer { get; private set; }
    public int? RatingOrdinal { get; private set; }
    public bool IsNotApplicable { get; private set; }
    public string? NotApplicableReason { get; private set; }

    internal static EvaluationQuestionAnswer Create(
        Guid tenantId,
        Guid assignmentId,
        Guid questionSnapshotId,
        string? textAnswer,
        int? ratingOrdinal,
        bool isNotApplicable,
        string? notApplicableReason) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AssignmentId = assignmentId,
            QuestionSnapshotId = questionSnapshotId,
            TextAnswer = textAnswer,
            RatingOrdinal = ratingOrdinal,
            IsNotApplicable = isNotApplicable,
            NotApplicableReason = notApplicableReason
        };

    internal void Update(
        string? textAnswer,
        int? ratingOrdinal,
        bool isNotApplicable,
        string? notApplicableReason)
    {
        TextAnswer = textAnswer;
        RatingOrdinal = ratingOrdinal;
        IsNotApplicable = isNotApplicable;
        NotApplicableReason = notApplicableReason;
        UpdatedAt = DateTime.UtcNow;
    }
}
