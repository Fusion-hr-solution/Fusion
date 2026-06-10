using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class QuestionGradeResult : AggregateRoot
{
    public Guid AttemptId { get; set; }
    public Guid QuestionId { get; set; }
    public string GraderType { get; set; } = string.Empty;
    public decimal Score { get; set; }
    public decimal MaxScore { get; set; }
    public string? Feedback { get; set; }
    public bool NeedsHumanReview { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedBy { get; set; }

    public CandidateTestAttempt Attempt { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
