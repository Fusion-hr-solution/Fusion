using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateManagementService
{
    Task<CandidateManagementOverviewDto> GetOverviewAsync(CancellationToken cancellationToken);
    Task<CandidateLinkSecurityStateDto> GetLinkSecurityAsync(string testId, CancellationToken cancellationToken);
    Task<CandidateLinkSecurityStateDto> SaveLinkSecurityAsync(UpdateCandidateLinkSecuritySettingsDto request, CancellationToken cancellationToken);
    Task<CandidateLinkSecurityStateDto> RegenerateLinkAsync(string testId, CancellationToken cancellationToken);
}
