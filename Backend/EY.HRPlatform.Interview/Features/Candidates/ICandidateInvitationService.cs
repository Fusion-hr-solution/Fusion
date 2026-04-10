using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateInvitationService
{
    Task<CandidateInvitationDto> CreateAsync(CreateCandidateInvitationDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<CandidateInvitationDto>> CreateBulkAsync(CreateBulkCandidateInvitationsDto request, CancellationToken cancellationToken);
    Task<IReadOnlyList<CandidateInvitationDto>> GetPendingAsync(string? testId, CancellationToken cancellationToken);
    Task<CandidateInvitationDto> ResendAsync(string invitationId, CancellationToken cancellationToken);
}
