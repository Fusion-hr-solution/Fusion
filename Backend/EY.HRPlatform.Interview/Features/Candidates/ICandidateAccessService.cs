using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateAccessService
{
    Task<CandidateAccessValidationDto> ValidateAsync(string token, CancellationToken cancellationToken);
    Task<CandidateAccessSessionDto> StartOrResumeAsync(StartCandidateAttemptDto request, CancellationToken cancellationToken);
    Task<CandidateAccessSubmissionDto> SubmitAsync(SubmitCandidateAttemptDto request, CancellationToken cancellationToken);
    Task<RunCodeResultDto> RunCodeAsync(RunCodeRequestDto request, CancellationToken cancellationToken);
    Task<ProctoringIngestResultDto> SubmitProctoringEventsAsync(SubmitProctoringEventsDto request, CancellationToken cancellationToken);
}
