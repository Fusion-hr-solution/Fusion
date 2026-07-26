using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>One append-only status-history record on a follow-up action.</summary>
public sealed class CheckInFollowUpActionStatusEvent : BaseEntity
{
    public const int NoteMaxLength = 500;

    private CheckInFollowUpActionStatusEvent() { }

    public Guid ActionId { get; private set; }
    public FollowUpActionStatus FromStatus { get; private set; }
    public FollowUpActionStatus ToStatus { get; private set; }
    public Guid ActorEmployeeId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public string? Note { get; private set; }
    public DateTime OccurredAt { get; private set; }

    internal static CheckInFollowUpActionStatusEvent Create(
        Guid actionId,
        FollowUpActionStatus fromStatus,
        FollowUpActionStatus toStatus,
        Guid actorEmployeeId,
        string actorName,
        string? note,
        DateTime occurredAt)
        => new()
        {
            Id = Guid.NewGuid(),
            ActionId = actionId,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            ActorEmployeeId = actorEmployeeId,
            ActorName = (actorName ?? string.Empty).Trim(),
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            OccurredAt = occurredAt
        };
}
