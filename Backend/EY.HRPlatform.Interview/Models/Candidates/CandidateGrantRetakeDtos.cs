namespace EY.HRPlatform.Interview.Models.Candidates;

public class GrantCandidateRetakeRequestDto
{
    public string TestId { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public bool SendNotification { get; set; } = true;
}

public class CandidateRetakeGrantResultDto
{
    public string TestId { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string CandidateName { get; set; } = string.Empty;
    public string InvitationId { get; set; } = string.Empty;
    public string AttemptId { get; set; } = string.Empty;
    public int AttemptNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool NotificationSent { get; set; }
    public string InviteLink { get; set; } = string.Empty;
    public string TokenExpiresAtUtc { get; set; } = string.Empty;
}