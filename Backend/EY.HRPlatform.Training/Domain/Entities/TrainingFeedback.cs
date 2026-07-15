using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// A learner's post-training feedback: one record per (employee, training) — see ADR 0006.
/// The fixed "core" rating dimensions are the only fields the aggregation dashboards chart.
/// Feedback is immutable once submitted; <see cref="IsAnonymous"/> is a display flag only
/// (the author is always stored so dedup, reminders and response-rate keep working).
/// </summary>
public class TrainingFeedback : BaseEntity
{
    public Guid EmployeeId { get; private set; }

    public Guid TrainingId { get; private set; }
    public TrainingCourse Training { get; private set; } = null!;

    // --- Fixed core dimensions (1..5) ---
    public int OverallRating { get; private set; }
    public int ContentRating { get; private set; }
    public int RelevanceRating { get; private set; }

    /// <summary>Trainer rating (1..5). Null for e-learning trainings, which have no trainer.</summary>
    public int? TrainerRating { get; private set; }

    public bool WouldRecommend { get; private set; }

    public string? Comment { get; private set; }
    public string? Suggestions { get; private set; }

    public bool IsAnonymous { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    private readonly List<FeedbackAnswer> _answers = [];
    /// <summary>Answers to custom (non-core) questions — Slice 3 (US-8.1.3).</summary>
    public IReadOnlyCollection<FeedbackAnswer> Answers => _answers.AsReadOnly();

    private TrainingFeedback() { }

    public TrainingFeedback(
        Guid employeeId,
        Guid trainingId,
        int overallRating,
        int contentRating,
        int relevanceRating,
        bool wouldRecommend,
        int? trainerRating,
        string? comment,
        string? suggestions,
        bool isAnonymous)
    {
        EmployeeId = employeeId;
        TrainingId = trainingId;
        OverallRating = overallRating;
        ContentRating = contentRating;
        RelevanceRating = relevanceRating;
        WouldRecommend = wouldRecommend;
        TrainerRating = trainerRating;
        Comment = comment;
        Suggestions = suggestions;
        IsAnonymous = isAnonymous;
        SubmittedAt = DateTime.UtcNow;
    }

    public void AddAnswer(FeedbackAnswer answer) => _answers.Add(answer);
}
