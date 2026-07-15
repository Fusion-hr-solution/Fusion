namespace EY.HRPlatform.Training.Models.Responses;

// ── Per-training (US-8.1.2 §1) ───────────────────────────────────────────

public class TrainingFeedbackSummaryDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int TotalResponses { get; set; }
    public double AvgOverallRating { get; set; }
    public double AvgContentRating { get; set; }
    public double AvgRelevanceRating { get; set; }
    public double? AvgTrainerRating { get; set; }
    public double RecommendationRate { get; set; }
    /// <summary>Overall-rating counts, index 0 = 1★ … index 4 = 5★.</summary>
    public int[] RatingDistribution { get; set; } = new int[5];
    public List<FeedbackTrendPointDto> MonthlyTrend { get; set; } = [];
    /// <summary>True when comments are hidden because the training has fewer than 3 responses.</summary>
    public bool CommentsSuppressed { get; set; }
    public List<FeedbackCommentDto> Comments { get; set; } = [];
}

public class FeedbackTrendPointDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Label { get; set; } = string.Empty;
    public double AvgOverallRating { get; set; }
    public int ResponseCount { get; set; }
}

public class FeedbackCommentDto
{
    public string Author { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public int OverallRating { get; set; }
    public DateTime SubmittedAt { get; set; }
    /// <summary>Set only in the per-trainer view (comments span multiple trainings).</summary>
    public string? TrainingTitle { get; set; }
}

// ── Per-trainer (US-8.1.2 §2) ────────────────────────────────────────────

public class TrainerFeedbackListItemDto
{
    public string TrainerKey { get; set; } = string.Empty;
    public string TrainerName { get; set; } = string.Empty;
    public int SessionsCount { get; set; }
    public int FeedbackCount { get; set; }
    public double AvgTrainerRating { get; set; }
    public double RecommendationRate { get; set; }
}

public class TrainerFeedbackDetailDto
{
    public string TrainerKey { get; set; } = string.Empty;
    public string TrainerName { get; set; } = string.Empty;
    public int SessionsCount { get; set; }
    public int FeedbackCount { get; set; }
    public double AvgTrainerRating { get; set; }
    public double RecommendationRate { get; set; }
    public List<TrainerTrainingBreakdownDto> Trainings { get; set; } = [];
    public bool CommentsSuppressed { get; set; }
    public List<FeedbackCommentDto> Comments { get; set; } = [];
}

public class TrainerTrainingBreakdownDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public int FeedbackCount { get; set; }
    public double AvgTrainerRating { get; set; }
}

// ── Global overview (US-8.1.2 §3) ────────────────────────────────────────

public class FeedbackOverviewDto
{
    public int TotalFeedbacks { get; set; }
    public double AvgOverallRating { get; set; }
    public double RecommendationRate { get; set; }
    /// <summary>feedbacks ÷ completions since the feedback feature launched.</summary>
    public double ResponseRate { get; set; }
    public int[] RatingDistribution { get; set; } = new int[5];
    public List<FeedbackTrendPointDto> MonthlyTrend { get; set; } = [];
    public List<TrainingRatingDto> TopTrainings { get; set; } = [];
    public List<TrainingRatingDto> BottomTrainings { get; set; } = [];
}

public class TrainingRatingDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public double AvgOverallRating { get; set; }
    public int ResponseCount { get; set; }
}
