using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class SubmitTrainerGroupFeedbackRequest
{
    [Required]
    public Guid SessionId { get; set; }

    [Range(1, 5)]
    public int GroupEngagement { get; set; }

    [Range(1, 5)]
    public int KnowledgeLevel { get; set; }

    [MaxLength(2000)]
    public string? Comments { get; set; }

    [MaxLength(2000)]
    public string? PrerequisiteSuggestions { get; set; }
}
