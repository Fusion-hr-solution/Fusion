using EY.HRPlatform.Interview.Domain.Enums;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class Question
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public Difficulty Difficulty { get; set; }
    public GradingMethod GradingMethod { get; set; }
    public int Points { get; set; }
    public int DurationMinutes { get; set; }
    public List<string> Tags { get; set; } = [];
    public int UsageCount { get; set; }
    public string? Language { get; set; }
    public string? StarterCode { get; set; }
    public string? EvaluationCriteria { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<QuestionOption> Options { get; set; } = new List<QuestionOption>();
}
