using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateContentBlockRequest
{
    [Required]
    public string Type { get; set; } = "Article";

    [MaxLength(300)]
    public string? Title { get; set; }

    public string? TextContent { get; set; }

    [MaxLength(500)]
    public string? ContentUri { get; set; }

    [MaxLength(500)]
    public string? VideoUrl { get; set; }

    [Range(1, 600)]
    public int? EstimatedDurationMinutes { get; set; }
}
