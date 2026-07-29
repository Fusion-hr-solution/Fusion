namespace EY.HRPlatform.Interview.Models.Tests;

public class TestDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Discipline { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<string> QuestionTypes { get; set; } = [];
    public int? MaxAttempts { get; set; }
    public bool AllowSkipping { get; set; }
    public bool AllowBacktracking { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeOrder { get; set; }
    public bool EnableProctoring { get; set; }
    public bool EnableActivityMonitoring { get; set; }
    public bool RestrictCopyPaste { get; set; }
    public int CandidateCount { get; set; }
    public int QuestionCount { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}