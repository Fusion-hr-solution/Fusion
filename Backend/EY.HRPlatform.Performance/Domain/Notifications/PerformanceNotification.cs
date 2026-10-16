using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Notifications;

/// <summary>
/// An in-app record of something that happened for one recipient (D-30). Staged beside the
/// outbox message of the same transition, so both commit or roll back together. Text, actor and
/// path are frozen at creation: later renames never rewrite what the person was told.
/// </summary>
public sealed class PerformanceNotification : PerformanceChildEntity
{
    public const int RetentionDays = 180;

    private PerformanceNotification() { }

    /// <summary>The recipient's employee record; null for a facilitator without one.</summary>
    public Guid? RecipientEmployeeId { get; private set; }
    /// <summary>The recipient's account, when the transition addresses an account (facilitators).</summary>
    public Guid? RecipientUserId { get; private set; }
    public PerformanceNotificationKind Kind { get; private set; }
    public string ResourceType { get; private set; } = string.Empty;
    public Guid ResourceId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Context { get; private set; }
    public string? ActorName { get; private set; }
    public string Href { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }
    public DateTime? ReadAt { get; private set; }
    /// <summary>The outbox message's dedupe key: one notification per transition and recipient.</summary>
    public string DedupeKey { get; private set; } = string.Empty;

    public static PerformanceNotification For(PerformanceOutboxMessage message, Guid? recipientUserId,
        PerformanceNotificationText text, DateTime occurredAt)
    {
        var employee = message.RecipientEmployeeId == Guid.Empty ? (Guid?)null : message.RecipientEmployeeId;
        if (employee is null && recipientUserId is null)
            throw new ArgumentException("A notification needs a recipient.");
        if (string.IsNullOrWhiteSpace(text.Title) || !text.Href.StartsWith("/performance/", StringComparison.Ordinal))
            throw new ArgumentException("A notification needs a title and an in-app Performance path.");
        return new PerformanceNotification
        {
            TenantId = message.TenantId,
            RecipientEmployeeId = employee,
            RecipientUserId = recipientUserId,
            Kind = message.Kind,
            ResourceType = message.ResourceType,
            ResourceId = message.ResourceId,
            Title = text.Title,
            Context = text.Context,
            ActorName = text.ActorName,
            Href = text.Href,
            OccurredAt = occurredAt,
            DedupeKey = message.DedupeKey,
        };
    }

    public bool IsAddressedTo(Guid? employeeId, Guid? userId)
        => (employeeId is Guid e && RecipientEmployeeId == e) || (userId is Guid u && RecipientUserId == u);

    public void MarkRead(DateTime now)
    {
        if (ReadAt is null) ReadAt = now;
    }
}

/// <summary>Display text and path composed by Performance, in English, when the notification is made.</summary>
public sealed record PerformanceNotificationText(string Title, string? Context, string? ActorName, string Href);
