using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidateAccessValidationDto
{
    public bool IsValid { get; set; }
    public bool CanStart { get; set; }
    public bool CanResume { get; set; }
    public bool CanSubmit { get; set; }
    public bool RequiresEmailVerification { get; set; }
    public bool RequiresIpLock { get; set; }
    public bool RequiresBrowserFingerprint { get; set; }
    public bool SingleUseLinkEnabled { get; set; }
    public string Status { get; set; } = "Invalid";
    public string Message { get; set; } = string.Empty;
    public string? InvitationId { get; set; }
    public string? TestId { get; set; }
    public string? TestTitle { get; set; }
    public string? CandidateEmail { get; set; }
    public string? CandidateName { get; set; }
    public string? DeadlineUtc { get; set; }
    public string? TokenExpiresAtUtc { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool AllowSkipping { get; set; }
    public bool AllowBacktracking { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeOrder { get; set; }
    /// <summary>If the test has a Frontend Project question, its framework ("react" | "angular" |
    /// "next"); null otherwise. Lets the candidate UI pre-warm the WebContainer before the attempt
    /// (and its timer) starts.</summary>
    public string? FrontendFramework { get; set; }
}

public class StartCandidateAttemptDto
{
    public string Token { get; set; } = string.Empty;
    public string? CandidateEmail { get; set; }
    public string? BrowserFingerprint { get; set; }
    public string? ClientIpAddress { get; set; }
    public string? UserAgent { get; set; }
}

public class SubmitCandidateAttemptDto
{
    public string Token { get; set; } = string.Empty;
    public string? BrowserFingerprint { get; set; }
    public string? ClientIpAddress { get; set; }
    public string? UserAgent { get; set; }
    public JsonElement? Answers { get; set; }
    public JsonElement? Result { get; set; }
}

public class CandidateAccessSessionDto
{
    public string InvitationId { get; set; } = string.Empty;
    public string AttemptId { get; set; } = string.Empty;
    public string TestId { get; set; } = string.Empty;
    public string TestTitle { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string Status { get; set; } = "Invited";
    public string? DeadlineUtc { get; set; }
    public string TokenExpiresAtUtc { get; set; } = string.Empty;
    public int? TimeLimitMinutes { get; set; }
    public string StartedAtUtc { get; set; } = string.Empty;
    public string? SubmittedAtUtc { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public string ResultJson { get; set; } = "{}";
    public bool AllowSkipping { get; set; }
    public bool AllowBacktracking { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeOrder { get; set; }
    public List<CandidateAccessQuestionDto> Questions { get; set; } = [];
}

public class CandidateAccessQuestionDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int Points { get; set; }
    public int DurationMinutes { get; set; }
    public string? Language { get; set; }
    public string? StarterCode { get; set; }
    /// <summary>Multi-file coding question starter: JSON { entry, files: [{ path, content }] }.
    /// For a Frontend Project this is the candidate-visible starter file tree.</summary>
    public string? ProjectFiles { get; set; }
    /// <summary>Frontend Project questions: framework ("react" | "angular" | "next") the candidate
    /// builds in. NOTE: the author's grading tests (FrontendTestFiles) are deliberately NOT exposed
    /// here — they stay server-side.</summary>
    public string? Framework { get; set; }
    public string? EvaluationCriteria { get; set; }
    public List<CandidateAccessQuestionOptionDto> Options { get; set; } = [];
}

public class CandidateAccessQuestionOptionDto
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

/// <summary>
/// Candidate request to compile/run their code for a single coding/SQL question, against
/// their own optional stdin. Nothing is graded or persisted — this is a pre-submit check.
/// </summary>
public class RunCodeRequestDto
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    public Guid QuestionId { get; set; }

    /// <summary>Single-file source. Provide this OR <see cref="Files"/> (multi-file).
    /// Cap matches <see cref="ProjectFileDto.Content"/> so single- and multi-file inputs
    /// share one per-file size limit.</summary>
    [MaxLength(64000)]
    public string? SourceCode { get; set; }

    /// <summary>Multi-file project. When non-empty, the run packages these files and runs
    /// <see cref="EntryPath"/> (defaults to the first file). Authoritative caps live in
    /// Judge0ProjectBuilder; this is a cheap early guard (keep in sync with MaxFiles = 20).</summary>
    [MaxLength(20)]
    public List<ProjectFileDto>? Files { get; set; }

    [MaxLength(200)]
    public string? EntryPath { get; set; }

    /// <summary>Ignored server-side — the run always uses the question's stored language so a
    /// candidate's run executes in the same language it will be graded in. Kept for wire
    /// compatibility with existing clients.</summary>
    [MaxLength(40)]
    public string? Language { get; set; }

    [MaxLength(10000)]
    public string? Stdin { get; set; }

    /// <summary>Browser fingerprint, sent by the client like start/submit. Re-validated against
    /// the invitation's bound fingerprint so a leaked token can't run code from another browser
    /// when single-use / fingerprint lock is enabled.</summary>
    [MaxLength(1024)]
    public string? BrowserFingerprint { get; set; }

    /// <summary>Set server-side from the connection (not trusted from the client).</summary>
    [MaxLength(64)]
    public string? ClientIpAddress { get; set; }

    /// <summary>Set server-side from the request headers (not trusted from the client).</summary>
    [MaxLength(1024)]
    public string? UserAgent { get; set; }
}

public class ProjectFileDto
{
    [Required]
    [MaxLength(200)]
    public string Path { get; set; } = string.Empty;

    [MaxLength(64000)]
    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// Result of a candidate code run. <see cref="RunId"/>/<see cref="Status"/> are carried now so
/// a later async execution model (return Queued + poll a status endpoint) is an additive change.
/// </summary>
public class RunCodeResultDto
{
    public string RunId { get; set; } = string.Empty;

    /// <summary>"Completed" today; "Queued"/"Running" reserved for the future async model.</summary>
    public string Status { get; set; } = "Completed";

    /// <summary>Judge0 status description, e.g. "Accepted", "Runtime Error (NZEC)", "Time Limit Exceeded".</summary>
    public string ExecutionStatus { get; set; } = string.Empty;

    public string? Stdout { get; set; }
    public string? Stderr { get; set; }
    public string? CompileOutput { get; set; }
    public string? Time { get; set; }
    public int? Memory { get; set; }
}

public class CandidateAccessSubmissionDto
{
    public string InvitationId { get; set; } = string.Empty;
    public string AttemptId { get; set; } = string.Empty;
    public string TestId { get; set; } = string.Empty;
    public string TestTitle { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string Status { get; set; } = "Submitted";
    public string SubmittedAtUtc { get; set; } = string.Empty;
    public string AnswersJson { get; set; } = "{}";
    public string ResultJson { get; set; } = "{}";
}
