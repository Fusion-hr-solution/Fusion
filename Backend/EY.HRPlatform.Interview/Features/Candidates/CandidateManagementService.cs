using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateManagementService(ICandidateInvitationService invitationService) : ICandidateManagementService
{
    public async Task<CandidateManagementOverviewDto> GetOverviewAsync(CancellationToken cancellationToken)
    {
        var pendingInvitations = await invitationService.GetPendingAsync(null, cancellationToken);
        var pendingCount = pendingInvitations.Count;
        var deliveryFailedCount = pendingInvitations.Count(item => IsStatus(item.Status, "DeliveryFailed"));

        var overview = new CandidateManagementOverviewDto
        {
            PendingInvitations = pendingCount,
            DeliveryFailed = deliveryFailedCount,
            ExpiringLinks = 0,
            InProgressCandidates = 0,
            RetakeRequests = 0,
            PendingDeletion = 0,
            GeneratedAtUtc = DateTime.UtcNow.ToString("O"),
        };

        return overview;
    }

    private static bool IsStatus(string? value, string expected)
    {
        return string.Equals(value?.Trim(), expected, StringComparison.OrdinalIgnoreCase);
    }
}
