using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateAccessService
{
    Task<CandidateAccessValidationDto> ValidateAsync(string token, CancellationToken cancellationToken);
    Task<CandidateAccessSessionDto> StartOrResumeAsync(string token, CancellationToken cancellationToken);
    Task<CandidateAccessSubmissionDto> SubmitAsync(SubmitCandidateAttemptDto request, CancellationToken cancellationToken);
}
