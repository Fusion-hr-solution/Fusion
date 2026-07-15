using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// A custom feedback question appended to the fixed core form for a training Category (US-8.1.3).
/// Append-only: questions are soft-retired (<see cref="IsRetired"/>), never hard-deleted, so that
/// historical <see cref="FeedbackAnswer"/> rows stay interpretable (see ADR 0006).
/// </summary>
public class FeedbackQuestion : BaseEntity
{
    /// <summary>The training category this question applies to; null = the default form (all categories).</summary>
    public Guid? CategoryId { get; private set; }

    public FeedbackQuestionType Type { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public int Order { get; private set; }

    /// <summary>JSON-encoded choice list, used only by <see cref="FeedbackQuestionType.MultipleChoice"/>.</summary>
    public string? Options { get; private set; }

    public bool IsRetired { get; private set; }

    private FeedbackQuestion() { }

    public FeedbackQuestion(Guid? categoryId, FeedbackQuestionType type, string label, int order, string? options)
    {
        CategoryId = categoryId;
        Type = type;
        Label = label;
        Order = order;
        Options = options;
    }

    public void Update(string label, string? options)
    {
        Label = label;
        Options = options;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reorder(int order)
    {
        Order = order;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Retire()
    {
        IsRetired = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
