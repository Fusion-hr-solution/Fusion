namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidateInvitationDto
{
    public string Id { get; set; } = string.Empty;
    public string TestId { get; set; } = string.Empty;
    public string TestTitle { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string Status { get; set; } = "Invited";
    public string? DeadlineUtc { get; set; }
    public string InviteMethod { get; set; } = "email";
    public int LinkExpiryHours { get; set; } = 72;
    public string TokenCreatedAtUtc { get; set; } = string.Empty;
    public string TokenExpiresAtUtc { get; set; } = string.Empty;
    public int? TimeLimitMinutes { get; set; }
    public string? CustomMessage { get; set; }
    public string InviteLink { get; set; } = string.Empty;
    public string CreatedAtUtc { get; set; } = string.Empty;
    public string LastSentAtUtc { get; set; } = string.Empty;
    public int ResendCount { get; set; }
    public int OpensCount { get; set; }
}
