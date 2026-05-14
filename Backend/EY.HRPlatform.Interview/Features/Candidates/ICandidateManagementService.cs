using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateManagementService
{
    Task<CandidateManagementOverviewDto> GetOverviewAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<CandidateTimelineCandidateDto>> GetTimelineCandidatesAsync(string testId, CancellationToken cancellationToken);
    Task<CandidateProgressTimelineDto> GetTimelineAsync(string testId, string candidateEmail, CancellationToken cancellationToken);
    Task<CandidateRetakeGrantResultDto> GrantRetakeAsync(GrantCandidateRetakeRequestDto request, CancellationToken cancellationToken);
    Task<CandidateAttemptSettingsDto> GetAttemptSettingsAsync(CancellationToken cancellationToken);
    Task<CandidateAttemptSettingsDto> SaveAttemptSettingsAsync(UpdateCandidateAttemptSettingsDto request, CancellationToken cancellationToken);
    Task<CandidatePrivacyActionResultDto> ApplyPrivacyActionAsync(CandidatePrivacyActionRequestDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<CandidatePrivacyActionResultDto>> ApplyPrivacyActionBatchAsync(CandidatePrivacyActionBatchRequestDto request, CancellationToken cancellationToken);
    Task<CandidateLinkSecurityStateDto> GetLinkSecurityAsync(string testId, CancellationToken cancellationToken);
    Task<CandidateLinkSecurityStateDto> SaveLinkSecurityAsync(UpdateCandidateLinkSecuritySettingsDto request, CancellationToken cancellationToken);
    Task<CandidateLinkSecurityStateDto> RegenerateLinkAsync(string testId, CancellationToken cancellationToken);
}
