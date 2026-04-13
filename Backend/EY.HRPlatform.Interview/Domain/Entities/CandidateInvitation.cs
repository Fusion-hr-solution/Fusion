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
    public int? TimeLimitMinutes { get; set; }
    public string? CustomMessage { get; set; }
    public string InviteLink { get; set; } = string.Empty;
    public DateTime LastSentAtUtc { get; set; } = DateTime.UtcNow;
    public int ResendCount { get; set; }
    public int OpensCount { get; set; }

    public Test? Test { get; set; }

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
