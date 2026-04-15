namespace EY.HRPlatform.Interview.Models.Candidates;

public class CreateBulkCandidateInvitationsDto
{
    public string TestId { get; set; } = string.Empty;
    public List<string> Emails { get; set; } = [];
    public List<CreateCandidateInvitationEntryDto> Candidates { get; set; } = [];
    public string? CandidateName { get; set; }
    public string? DeadlineUtc { get; set; }
    public string InviteMethod { get; set; } = "bulk";
    public int? LinkExpiryHours { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public string? CustomMessage { get; set; }
    public bool SendNotification { get; set; } = true;
}
