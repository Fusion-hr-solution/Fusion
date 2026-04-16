namespace EY.HRPlatform.Interview.Models.Candidates;

public class CreateCandidateInvitationEntryDto
{
    public string Email { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
}
