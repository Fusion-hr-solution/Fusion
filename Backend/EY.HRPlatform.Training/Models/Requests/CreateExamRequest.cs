using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateExamRequest
{
    [Required, MaxLength(300)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Range(1, 100)]
    public int PassingScore { get; set; } = 80;

    [Range(1, 600)]
    public int? DurationMinutes { get; set; }
}
