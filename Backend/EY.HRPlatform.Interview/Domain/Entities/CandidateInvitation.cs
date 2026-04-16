using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidateInvitation : AggregateRoot
{
    public Guid TestId { get; set; }
    public string TestTitle { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string Status { get; set; } = "Invited";
    public DateTime? DeadlineUtc { get; set; }
    public string InviteMethod { get; set; } = "email";
    public int LinkExpiryHours { get; set; } = 72;
    public int? TimeLimitMinutes { get; set; }
    public string? CustomMessage { get; set; }
    public string InviteLink { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime TokenCreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime TokenExpiresAtUtc { get; set; } = DateTime.UtcNow.AddHours(72);
    public DateTime LastSentAtUtc { get; set; } = DateTime.UtcNow;
    public int ResendCount { get; set; }
    public int OpensCount { get; set; }
    public DateTime? AttemptStartedAtUtc { get; set; }
    public DateTime? AttemptSubmittedAtUtc { get; set; }

    public Test? Test { get; set; }
    public CandidateTestAttempt? Attempt { get; set; }

    public void SetCreatedAt(DateTime createdAt)
    {
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public void SetUpdatedAt(DateTime updatedAt)
    {
        UpdatedAt = updatedAt;
    }
}
