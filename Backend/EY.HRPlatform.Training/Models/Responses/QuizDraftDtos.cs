namespace EY.HRPlatform.Training.Models.Responses;

public class QuizDraftOptionDto
{
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}

public class QuizDraftQuestionDto
{
    public string Text { get; set; } = string.Empty;
    /// <summary>QuestionType name — "SingleChoice" | "MultipleChoice" | "TrueFalse".</summary>
    public string Type { get; set; } = "SingleChoice";
    public int Points { get; set; } = 1;
    public string? Explanation { get; set; }
    public int Order { get; set; }
    /// <summary>"ai" | "manual".</summary>
    public string Source { get; set; } = "ai";
    public List<QuizDraftOptionDto> Options { get; set; } = [];
}

public class QuizDraftDto
{
    public Guid TrainingId { get; set; }
    /// <summary>Whether the AI quiz generator is configured (drives the "Generate with AI" button).</summary>
    public bool AiAvailable { get; set; }
    public List<QuizDraftQuestionDto> Questions { get; set; } = [];
}
