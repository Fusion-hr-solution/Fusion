using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateChapterRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string ContentType { get; set; } = "Article";

    [MaxLength(500)]
    public string? ContentUri { get; set; }

    public int OrderIndex { get; set; }

    public string? TextContent { get; set; }

    [MaxLength(500)]
    public string? VideoUrl { get; set; }

    [Range(1, 600)]
    public int? EstimatedDurationMinutes { get; set; }
}
