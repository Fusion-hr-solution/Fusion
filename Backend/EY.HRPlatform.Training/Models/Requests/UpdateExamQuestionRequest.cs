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

    [Required, MinLength(2)]
    public List<ExamOptionInput> Options { get; set; } = [];
}
