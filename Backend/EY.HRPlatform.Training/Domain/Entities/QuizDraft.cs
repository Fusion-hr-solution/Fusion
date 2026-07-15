using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// US-8.2.5 — a transient, per-training working set of quiz questions (AI-generated and/or hand-edited)
/// that an admin reviews before publishing into the training's Exam. Stored as JSONB; replaced on
/// regenerate; cleared on publish. Scratch space, not a published artifact (ADR 0009).
/// </summary>
public class QuizDraft : BaseEntity
{
    public Guid TrainingId { get; private set; }
    public Guid CreatedByEmployeeId { get; private set; }

    /// <summary>Serialized draft questions (text, options, correctIndex, explanation, order, source).</summary>
    public string QuestionsJson { get; private set; } = "[]";

    private QuizDraft() { }

    public QuizDraft(Guid trainingId, Guid createdByEmployeeId, string questionsJson)
    {
        TrainingId = trainingId;
        CreatedByEmployeeId = createdByEmployeeId;
        QuestionsJson = questionsJson;
    }

    public void Replace(string questionsJson, Guid byEmployeeId)
    {
        QuestionsJson = questionsJson;
        CreatedByEmployeeId = byEmployeeId;
        UpdatedAt = DateTime.UtcNow;
    }
}
