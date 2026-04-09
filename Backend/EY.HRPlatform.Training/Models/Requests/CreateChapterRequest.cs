using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateChapterRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Layout { get; set; } = "SingleContent";

    public int OrderIndex { get; set; }

    public List<CreateContentBlockRequest> ContentBlocks { get; set; } = [];
}

public class CreateContentBlockRequest
{
    [Required]
    public string Type { get; set; } = "Article";

    public int OrderIndex { get; set; }

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
