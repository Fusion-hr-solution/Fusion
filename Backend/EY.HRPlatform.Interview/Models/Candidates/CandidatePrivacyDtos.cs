namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidatePrivacyActionRequestDto
{
    public string TestId { get; set; } = string.Empty;
    public string? CandidateEmail { get; set; }
    public string? InvitationId { get; set; }
    public string Action { get; set; } = "anonymize";
    public string AdminId { get; set; } = string.Empty;
    public string TriggerSource { get; set; } = "UI";
}

public class CandidatePrivacyActionBatchRequestDto
{
    public string TestId { get; set; } = string.Empty;
    public List<string> CandidateEmails { get; set; } = [];
    public List<string> InvitationIds { get; set; } = [];
    public string Action { get; set; } = "anonymize";
    public string AdminId { get; set; } = string.Empty;
    public string TriggerSource { get; set; } = "UI";
}

public class CandidatePrivacyActionResultDto
{
    public string Action { get; set; } = string.Empty;
    public string TestId { get; set; } = string.Empty;
    public string AdminId { get; set; } = string.Empty;
    public string TriggerSource { get; set; } = string.Empty;
    public string CandidateAliasEmail { get; set; } = string.Empty;
    public string CandidateAliasName { get; set; } = string.Empty;
    public string CandidateEmailHash { get; set; } = string.Empty;
    public IReadOnlyList<string> InvitationIds { get; set; } = [];
    public int InvitationsUpdated { get; set; }
    public int AttemptsUpdated { get; set; }
    public int EventsUpdated { get; set; }
    public string LoggedAtUtc { get; set; } = string.Empty;
}
