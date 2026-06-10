using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidateTestAttempt : AggregateRoot
{
    public Guid InvitationId { get; set; }
    public int AttemptNumber { get; set; } = 1;
    public Guid TestId { get; set; }
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAtUtc { get; set; }
    public string AnswersJson { get; set; } = "[]";
    public string ResultJson { get; set; } = "{}";
    public GradingStatus GradingStatus { get; set; } = GradingStatus.Pending;
    public decimal? TotalScore { get; set; }
    public decimal? MaxScore { get; set; }

    public CandidateInvitation Invitation { get; set; } = null!;
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