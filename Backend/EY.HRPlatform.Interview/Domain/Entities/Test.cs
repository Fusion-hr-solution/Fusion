using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class Test : AggregateRoot
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Admin-curatable label (see <see cref="InterviewTaxonomy"/>). Free-form —
    /// it categorises tests and carries no behaviour.</summary>
    public string Discipline { get; set; } = string.Empty;
    public TestStatus Status { get; set; } = TestStatus.Draft;
    public int? MaxAttempts { get; set; }
    public bool AllowSkipping { get; set; }
    public bool AllowBacktracking { get; set; } = true;
    public bool ShowProgressBar { get; set; } = true;
    public bool RandomizeOrder { get; set; }
    // Proctoring flags (all default off). Layer A = webcam; Layer B = browser-integrity.
    public bool EnableProctoring { get; set; }        // Layer A — webcam detection (camera + consent)
    public bool EnableActivityMonitoring { get; set; } // Layer B — tab/window switch, fullscreen, 2nd display
    public bool RestrictCopyPaste { get; set; }        // Layer B — block + log clipboard in answer UI
    /// <summary>Author-set pass mark as a percentage (0–100); null = no pass mark configured. Drives the
    /// reviewer report's pass/fail verdict.</summary>
    public int? PassingThreshold { get; set; }
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