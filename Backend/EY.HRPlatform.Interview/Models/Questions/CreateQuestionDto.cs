using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Interview.Models.Questions;

public class CreateQuestionDto
{
    [Required]
    public string Type { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string Difficulty { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int Points { get; set; }

    [Range(1, int.MaxValue)]
    public int DurationMinutes { get; set; }

    [Required]
    public string GradingMethod { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = [];
    public List<QuestionOptionDto> Options { get; set; } = [];
    public string Language { get; set; } = string.Empty;
    public string StarterCode { get; set; } = string.Empty;
    /// <summary>Multi-file coding question: JSON { entry, files: [{ path, content }] }.</summary>
    public string? ProjectFiles { get; set; }
    /// <summary>Frontend Project questions: the framework ("react" | "angular" | "next").</summary>
    [MaxLength(40)]
    public string? Framework { get; set; }
    /// <summary>Frontend Project questions: the author's grading test suite, JSON
    /// { files: [{ path, content }] }. Candidate-hidden — never returned in the candidate DTO.</summary>
    public string? FrontendTestFiles { get; set; }
    public string EvaluationCriteria { get; set; } = string.Empty;
    public string? TestCases { get; set; }
}
