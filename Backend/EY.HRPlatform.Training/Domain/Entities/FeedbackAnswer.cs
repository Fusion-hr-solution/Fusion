using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// A learner's answer to a custom <see cref="FeedbackQuestion"/>. The question's label and type are
/// snapshotted at submit time so that later edits/retirement of the question never corrupt the
/// historical answer (ADR 0006).
/// </summary>
public class FeedbackAnswer : BaseEntity
{
    public Guid FeedbackId { get; private set; }
    public TrainingFeedback Feedback { get; private set; } = null!;

    public Guid QuestionId { get; private set; }
    public string QuestionLabelSnapshot { get; private set; } = string.Empty;
    public string QuestionTypeSnapshot { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;

    private FeedbackAnswer() { }

    public FeedbackAnswer(Guid questionId, string questionLabelSnapshot, string questionTypeSnapshot, string value)
    {
        QuestionId = questionId;
        QuestionLabelSnapshot = questionLabelSnapshot;
        QuestionTypeSnapshot = questionTypeSnapshot;
        Value = value;
    }
}
