namespace EY.HRPlatform.Interview.Models.Candidates;

public class CreateCandidateInvitationDto
{
    public string TestId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string? DeadlineUtc { get; set; }
    public string InviteMethod { get; set; } = "email";
    public int? TimeLimitMinutes { get; set; }
    public string? CustomMessage { get; set; }
    public bool SendNotification { get; set; } = true;
}
