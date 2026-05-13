using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class Test : AggregateRoot
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Discipline Discipline { get; set; }
    public TestStatus Status { get; set; } = TestStatus.Draft;
    public int? MaxAttempts { get; set; }
    public bool AllowSkipping { get; set; }
    public bool AllowBacktracking { get; set; } = true;
    public bool ShowProgressBar { get; set; } = true;
    public bool RandomizeOrder { get; set; }
    public int CandidateCount { get; set; }
    public ICollection<TestQuestion> TestQuestions { get; set; } = new List<TestQuestion>();

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