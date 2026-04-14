using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateTrainingRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [Range(0, 1000)]
    public int Credits { get; set; }

    public bool IsMandatory { get; set; }

    [Required]
    public string BadgeLevel { get; set; } = "Bronze";

    [MaxLength(50)]
    public string? Duration { get; set; }

    [Required]
    public Guid CategoryId { get; set; }

    public string? TrainingType { get; set; }

    public DateTime? ScheduledDate { get; set; }
}
