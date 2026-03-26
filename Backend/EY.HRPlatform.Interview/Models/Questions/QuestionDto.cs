using System;

namespace EY.HRPlatform.Interview.Models.Questions;

public class QuestionDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string GradingMethod { get; set; } = string.Empty;
    public int Points { get; set; }
    public int DurationMinutes { get; set; }
    public List<string> Tags { get; set; } = [];
    public int UsageCount { get; set; }
}
