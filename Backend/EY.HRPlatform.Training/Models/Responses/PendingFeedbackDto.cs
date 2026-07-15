namespace EY.HRPlatform.Training.Models.Responses;

public class PendingFeedbackDto
{
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;

    /// <summary>"ELearning" or "OnSite" — tells the form whether to collect a trainer rating.</summary>
    public string TrainingType { get; set; } = string.Empty;

    public DateTime CompletedAt { get; set; }
}
