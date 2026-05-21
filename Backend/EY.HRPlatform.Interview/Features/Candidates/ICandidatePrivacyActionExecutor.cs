using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidatePrivacyActionExecutor
{
    Task<CandidatePrivacyActionResultDto> PseudonymizeAsync(
        Guid testId,
        string normalizedEmail,
        string actionType,
        string adminId,
        string triggerSource,
        IReadOnlyList<CandidateInvitation> invitations,
        CancellationToken cancellationToken);
}
