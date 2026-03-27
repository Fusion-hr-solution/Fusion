namespace EY.HRPlatform.Interview.Models.Tests;

public class TestDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Discipline { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<string> QuestionTypes { get; set; } = [];
    public int CandidateCount { get; set; }
    public int QuestionCount { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}
