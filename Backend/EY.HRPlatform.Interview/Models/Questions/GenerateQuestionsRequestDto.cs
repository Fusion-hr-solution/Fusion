using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Interview.Models.Questions;

/// <summary>
/// Request to draft one or more questions with the AI generator. Only <see cref="Topic"/>
/// is required; the remaining controls constrain the output and are inferred by the model
/// when left blank. The endpoint returns unsaved <see cref="CreateQuestionDto"/> drafts.
/// </summary>
public class GenerateQuestionsRequestDto
{
    [Required]
    [MaxLength(2000)]
    public string Topic { get; set; } = string.Empty;

    public string? Type { get; set; }
    public string? Difficulty { get; set; }
    public string? GradingMethod { get; set; }
    public string? Language { get; set; }

    public int? Points { get; set; }
    public int? DurationMinutes { get; set; }

    /// <summary>How many questions to generate. Clamped to 1–10 by the service.</summary>
    public int Count { get; set; } = 1;
}
