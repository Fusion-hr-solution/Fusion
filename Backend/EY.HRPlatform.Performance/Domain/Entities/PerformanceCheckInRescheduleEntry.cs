using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// One append-only reschedule record on a check-in, narrating the transition from a previous
/// planned date/time to a new one, with the acting reviewer and timestamp.
/// </summary>
public sealed class PerformanceCheckInRescheduleEntry : BaseEntity
{
    private PerformanceCheckInRescheduleEntry() { }

    public Guid CheckInId { get; private set; }
    public DateTime PreviousDate { get; private set; }
    public string? PreviousTime { get; private set; }
    public DateTime NewDate { get; private set; }
    public string? NewTime { get; private set; }
    public Guid ActorReviewerId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }

    internal static PerformanceCheckInRescheduleEntry Create(
        Guid checkInId,
        DateTime previousDate,
        string? previousTime,
        DateTime newDate,
        string? newTime,
        Guid actorReviewerId,
        string actorName,
        DateTime occurredAt)
        => new()
        {
            Id = Guid.NewGuid(),
            CheckInId = checkInId,
            PreviousDate = previousDate,
            PreviousTime = string.IsNullOrWhiteSpace(previousTime) ? null : previousTime.Trim(),
            NewDate = newDate,
            NewTime = string.IsNullOrWhiteSpace(newTime) ? null : newTime.Trim(),
            ActorReviewerId = actorReviewerId,
            ActorName = (actorName ?? string.Empty).Trim(),
            OccurredAt = occurredAt
        };
}
