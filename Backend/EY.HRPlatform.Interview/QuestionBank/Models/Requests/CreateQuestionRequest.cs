namespace EY.HRPlatform.Interview.QuestionBank.Models.Requests;

public class CreateQuestionRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = "multipleChoice";
    public string Difficulty { get; set; } = "medium";
    public string GradingMethod { get; set; } = "automatic";
    public int Points { get; set; } = 10;
    public int DurationMinutes { get; set; } = 5;
    public List<string> Tags { get; set; } = new();
    public List<QuestionOptionDto>? Options { get; set; }
}

public class QuestionOptionDto
{
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int SortOrder { get; set; }
}