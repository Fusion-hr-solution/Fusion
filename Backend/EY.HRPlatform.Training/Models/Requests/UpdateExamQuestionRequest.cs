using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateExamQuestionRequest
{
    [Required, MaxLength(1000)]
    public string QuestionText { get; set; } = string.Empty;

    [Required]
    public string Type { get; set; } = "SingleChoice";

    [Range(1, 100)]
    public int Points { get; set; } = 1;

    /// <summary>Optional rationale for the correct answer (US-8.2.5).</summary>
    [MaxLength(2000)]
    public string? Explanation { get; set; }

    [Required, MinLength(2)]
    public List<ExamOptionInput> Options { get; set; } = [];
}
