using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class Question : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = "multipleChoice";
    public string Difficulty { get; set; } = "medium";
    public string GradingMethod { get; set; } = "automatic";
    public int Points { get; set; } = 10;
    public int DurationMinutes { get; set; } = 5;
    public List<string> Tags { get; set; } = new();
    public int UsageCount { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public List<QuestionOption>? Options { get; set; }
}

public class QuestionOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuestionId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int SortOrder { get; set; }
    public Question? Question { get; set; }
}