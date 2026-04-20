using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

public class CreateExamQuestionRequest
{
    [Required, MaxLength(1000)]
    public string QuestionText { get; set; } = string.Empty;

    /// <summary>SingleChoice, MultipleChoice, TrueFalse.</summary>
    [Required]
    public string Type { get; set; } = "SingleChoice";

    [Range(1, 100)]
    public int Points { get; set; } = 1;

    [Required, MinLength(2)]
    public List<ExamOptionInput> Options { get; set; } = [];
}

public class ExamOptionInput
{
    [Required, MaxLength(500)]
    public string OptionText { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }
}
