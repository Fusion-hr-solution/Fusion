using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateManagementService(ICandidateInvitationService invitationService) : ICandidateManagementService
{
    public async Task<CandidateManagementOverviewDto> GetOverviewAsync(CancellationToken cancellationToken)
    {
        var pendingInvitations = await invitationService.GetPendingAsync(null, cancellationToken);

        var overview = new CandidateManagementOverviewDto
        {
            PendingInvitations = pendingInvitations.Count,
            DeliveryFailed = 0,
            ExpiringLinks = 0,
            InProgressCandidates = 0,
            RetakeRequests = 0,
            PendingDeletion = 0,
            GeneratedAtUtc = DateTime.UtcNow.ToString("O"),
        };

        return overview;
    }
}
