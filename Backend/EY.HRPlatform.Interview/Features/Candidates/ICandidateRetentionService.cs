using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateRetentionService
{
    Task<CandidateRetentionStateDto> GetStateAsync(CancellationToken cancellationToken);
    Task<int> GetPendingCountAsync(CancellationToken cancellationToken);
    Task<CandidateRetentionSettingsDto> SaveSettingsAsync(UpdateCandidateRetentionSettingsDto request, CancellationToken cancellationToken);
    /// <returns>The completed run, or <c>null</c> if another instance already holds the sweep lock.</returns>
    Task<CandidateRetentionRunDto?> RunRetentionSweepAsync(string triggeredBy, string triggerSource, CancellationToken cancellationToken);
}
