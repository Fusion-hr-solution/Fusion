namespace EY.HRPlatform.Training.Models.Responses;

public class MyTrainingDto
{
    public Guid TrainingId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? Duration { get; set; }
    public int Credits { get; set; }
    public bool IsMandatory { get; set; }
    public string BadgeLevel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int ProgressPercentage { get; set; }
    public int CompletedChapters { get; set; }
    public int TotalChapters { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string AssignmentType { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }

    /// <summary>Average learner OverallRating (1..5, 2 decimals) from post-training feedback; null when unrated.</summary>
    public double? AverageRating { get; set; }
    public int RatingCount { get; set; }
}
