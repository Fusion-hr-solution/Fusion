using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Training.Models.Requests;

/// <summary>US-8.2.5 — body for saving a quiz draft or publishing it into the exam.</summary>
public class QuizDraftRequest
{
    public List<QuizDraftQuestionInput> Questions { get; set; } = [];
}

public class QuizDraftQuestionInput
{
    [MaxLength(2000)]
    public string Text { get; set; } = string.Empty;

    /// <summary>SingleChoice, MultipleChoice, TrueFalse.</summary>
    public string Type { get; set; } = "SingleChoice";

    [Range(1, 100)]
    public int Points { get; set; } = 1;

    [MaxLength(2000)]
    public string? Explanation { get; set; }

    /// <summary>"ai" | "manual" — informational; round-trips through the draft.</summary>
    public string? Source { get; set; }

    public List<QuizDraftOptionInput> Options { get; set; } = [];
}

public class QuizDraftOptionInput
{
    [MaxLength(500)]
    public string Text { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }
}
