using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Interview.Models.Tests;

public class CreateTestDto
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    [Required]
    public string Discipline { get; set; } = string.Empty;

    public string? Status { get; set; }

    public int? MaxAttempts { get; set; }

    public bool? AllowSkipping { get; set; }

    public bool? AllowBacktracking { get; set; }

    public bool? ShowProgressBar { get; set; }

    public bool? RandomizeOrder { get; set; }

    public bool? EnableProctoring { get; set; }

    public bool? EnableActivityMonitoring { get; set; }

    public bool? RestrictCopyPaste { get; set; }

    [Range(0, 100)]
    public int? PassingThreshold { get; set; }
}