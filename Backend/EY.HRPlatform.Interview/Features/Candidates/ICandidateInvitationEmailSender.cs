using EY.HRPlatform.Interview.Models.Candidates;

namespace EY.HRPlatform.Interview.Features.Candidates;

public interface ICandidateInvitationEmailSender
{
    Task SendInvitationAsync(CandidateInvitationDto invitation, CancellationToken cancellationToken);
}