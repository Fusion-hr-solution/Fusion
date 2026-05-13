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
    public string? EvaluationCriteria { get; set; }
    public List<CandidateAccessQuestionOptionDto> Options { get; set; } = [];
}

public class CandidateAccessQuestionOptionDto
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
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
