namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidateManagementOverviewDto
{
    public int PendingInvitations { get; set; }
    public int DeliveryFailed { get; set; }
    public int ExpiringLinks { get; set; }
    public int InProgressCandidates { get; set; }
    public int RetakeRequests { get; set; }
    public int PendingDeletion { get; set; }
    public string GeneratedAtUtc { get; set; } = string.Empty;
}
