using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateRetentionService
{
    Task<CandidateRetentionStateDto> GetStateAsync(CancellationToken cancellationToken);
    Task<CandidateRetentionSettingsDto> SaveSettingsAsync(UpdateCandidateRetentionSettingsDto request, CancellationToken cancellationToken);
    Task<CandidateRetentionRunDto> RunRetentionSweepAsync(string triggeredBy, string triggerSource, CancellationToken cancellationToken);
}
