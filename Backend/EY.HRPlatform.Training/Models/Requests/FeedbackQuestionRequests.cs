using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateFeedbackQuestionRequest
{
    /// <summary>Training category; null = the default form (applies to all categories).</summary>
    public Guid? CategoryId { get; set; }

    [Required]
    public string Type { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string Label { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Options { get; set; }
}

public class UpdateFeedbackQuestionRequest
{
    [Required, MaxLength(500)]
    public string Label { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Options { get; set; }
}

public class ReorderFeedbackQuestionsRequest
{
    [Required]
    public List<Guid> QuestionIds { get; set; } = [];
}
