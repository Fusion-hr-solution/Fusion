using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class SubmitFeedbackRequest
{
    [Required]
    public Guid TrainingId { get; set; }

    [Required, Range(1, 5)]
    public int OverallRating { get; set; }

    [Required, Range(1, 5)]
    public int ContentRating { get; set; }

    [Required, Range(1, 5)]
    public int RelevanceRating { get; set; }

    /// <summary>Only applicable to on-site trainings (which have a trainer). Null otherwise.</summary>
    [Range(1, 5)]
    public int? TrainerRating { get; set; }

    [Required]
    public bool? WouldRecommend { get; set; }

    [MaxLength(2000)]
    public string? Comment { get; set; }

    [MaxLength(2000)]
    public string? Suggestions { get; set; }

    public bool IsAnonymous { get; set; }
}
