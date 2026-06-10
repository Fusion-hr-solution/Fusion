using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class GradingJob : AggregateRoot
{
    public Guid AttemptId { get; set; }
    public DateTime? LockedAt { get; set; }
    public string? LockedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? FailedAt { get; set; }
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; }

    public CandidateTestAttempt Attempt { get; set; } = null!;
}
