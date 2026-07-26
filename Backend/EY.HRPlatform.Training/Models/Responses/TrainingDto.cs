namespace EY.HRPlatform.Training.Models.Responses;

public class TrainingDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Credits { get; set; }
    public bool IsMandatory { get; set; }
    public string BadgeLevel { get; set; } = string.Empty;
    public string? Duration { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int ChapterCount { get; set; }
    public string TrainingType { get; set; } = "ELearning";
    public string CostType { get; set; } = "Internal";
    public DateTime? ScheduledDate { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Average learner OverallRating (1..5, 2 decimals) from post-training feedback; null when unrated.</summary>
    public double? AverageRating { get; set; }
    public int RatingCount { get; set; }
}
