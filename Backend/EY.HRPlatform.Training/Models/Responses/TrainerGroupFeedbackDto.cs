namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>A session led by the current trainer, for the "Sessions I lead" surface (US-8.1.3).</summary>
public class TrainerSessionDto
{
    public Guid SessionId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string PartTitle { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Room { get; set; } = string.Empty;
    /// <summary>Effective status: Planned | InProgress | Completed.</summary>
    public string Status { get; set; } = string.Empty;
    public bool HasGroupFeedback { get; set; }
}

/// <summary>A trainer's group feedback for a session — admin-visible only.</summary>
public class TrainerGroupFeedbackDto
{
    public Guid SessionId { get; set; }
    public Guid TrainerEmployeeId { get; set; }
    public string TrainerName { get; set; } = string.Empty;
    public int GroupEngagement { get; set; }
    public int KnowledgeLevel { get; set; }
    public string? Comments { get; set; }
    public string? PrerequisiteSuggestions { get; set; }
    public DateTime SubmittedAt { get; set; }
}
