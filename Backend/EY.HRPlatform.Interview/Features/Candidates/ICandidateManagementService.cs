using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateManagementService
{
    Task<CandidateManagementOverviewDto> GetOverviewAsync(CancellationToken cancellationToken);
}
