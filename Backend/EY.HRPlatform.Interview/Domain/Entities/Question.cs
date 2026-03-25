using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class Question : AggregateRoot
{
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
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
    public ICollection<QuestionOption> Options { get; set; } = new List<QuestionOption>();
    public void SetCreatedAt(DateTime createdAt)
    {
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }
    public void SetUpdatedAt(DateTime updatedAt)
    {
        UpdatedAt = updatedAt;
    }

}
