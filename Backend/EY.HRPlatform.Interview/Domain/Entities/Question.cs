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
    /// <summary>For multi-file coding questions: JSON { entry, files: [{ path, content }] }.
    /// Null/empty means the question is single-file (uses <see cref="StarterCode"/>).</summary>
    public string? ProjectFiles { get; set; }
    /// <summary>FrontendProject questions only: the framework the candidate builds in
    /// ("react" | "angular" | "next"). Selects the in-browser runtime + starter template.</summary>
    public string? Framework { get; set; }
    /// <summary>FrontendProject questions only: the author's grading test suite as JSON
    /// { files: [{ path, content }] }. **Candidate-hidden** — never mapped into the candidate
    /// DTO; injected server-side only at grade time (like Judge0's hidden expectedOutput).</summary>
    public string? FrontendTestFiles { get; set; }
    public string? EvaluationCriteria { get; set; }
    public string? TestCases { get; set; }
    //public DateTime CreatedAt { get; protected set; }
    //public DateTime UpdatedAt { get; protected set; }
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