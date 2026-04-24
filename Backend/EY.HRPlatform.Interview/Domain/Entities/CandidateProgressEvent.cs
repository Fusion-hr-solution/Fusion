using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidateProgressEvent : AggregateRoot
{
    public Guid InvitationId { get; set; }
    public Guid TestId { get; set; }
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public Guid? AttemptId { get; set; }
    public int AttemptNumber { get; set; } = 1;
    public string Milestone { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
    public string? ClientIpAddress { get; set; }
    public string? BrowserFingerprintHash { get; set; }
    public string? UserAgent { get; set; }

    public CandidateInvitation? Invitation { get; set; }
    public CandidateTestAttempt? Attempt { get; set; }
    public Test? Test { get; set; }
}
