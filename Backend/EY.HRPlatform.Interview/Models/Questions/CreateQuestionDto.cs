namespace EY.HRPlatform.Interview.Models.Questions;

public class CreateQuestionDto
{
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public int Points { get; set; }
    public int DurationMinutes { get; set; }
    public string GradingMethod { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = [];
    public List<QuestionOptionDto> Options { get; set; } = [];
    public string Language { get; set; } = string.Empty;
    public string StarterCode { get; set; } = string.Empty;
    public string EvaluationCriteria { get; set; } = string.Empty;
}
