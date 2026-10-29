using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.SharedKernel.Notifications;

namespace EY.HRPlatform.Performance.Domain.Notifications;

/// <summary>
/// An in-app record of something that happened for one recipient (D-30). Staged beside the
/// outbox message of the same transition, so both commit or roll back together. It stores what happened (text keys
/// and the names, titles and dates they need), frozen at creation, and is worded in the reader's language when read
/// (B-153). Adding or reading one nudges the recipient's open tabs.
/// </summary>
public sealed class PerformanceNotification : PerformanceChildEntity, IFeedNudgeRecipient
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
    /// <summary>The catalogue entry for the title; null only on rows from before B-153.</summary>
    public string? TitleKey { get; private set; }
    public string? ContextKey { get; private set; }
    /// <summary>What the wording needs: names as written, titles, ISO dates, counts.</summary>
    public string ValuesJson { get; private set; } = "{}";
    public IReadOnlyDictionary<string, string> Values
        => JsonSerializer.Deserialize<Dictionary<string, string>>(ValuesJson) ?? [];
    /// <summary>English text written before B-153; shown as written for those rows.</summary>
    public string? Title { get; private set; }
    public string? Context { get; private set; }
    public string? ActorName { get; private set; }
    public string Href { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }
    public DateTime? ReadAt { get; private set; }
    /// <summary>The outbox message's dedupe key: one notification per transition and recipient.</summary>
    public string DedupeKey { get; private set; } = string.Empty;

    public static PerformanceNotification For(PerformanceOutboxMessage message, Guid? recipientUserId,
        PerformanceNotificationMessage text, DateTime occurredAt)
    {
        var employee = message.RecipientEmployeeId == Guid.Empty ? (Guid?)null : message.RecipientEmployeeId;
        if (employee is null && recipientUserId is null)
            throw new ArgumentException("A notification needs a recipient.");
        if (string.IsNullOrWhiteSpace(text.TitleKey) || !text.Href.StartsWith("/performance/", StringComparison.Ordinal))
            throw new ArgumentException("A notification needs a title and an in-app Performance path.");
        return new PerformanceNotification
        {
            TenantId = message.TenantId,
            RecipientEmployeeId = employee,
            RecipientUserId = recipientUserId,
            Kind = message.Kind,
            ResourceType = message.ResourceType,
            ResourceId = message.ResourceId,
            TitleKey = text.TitleKey,
            ContextKey = text.ContextKey,
            ValuesJson = JsonSerializer.Serialize(text.Values),
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

/// <summary>
/// What a notification says, as catalogue keys and values (worded per reader, B-153), plus who acted and where it
/// opens. Values hold names as written, titles, ISO dates (<c>yyyy-MM-dd</c>) and counts, never feedback or answers.
/// </summary>
public sealed record PerformanceNotificationMessage(string TitleKey, string? ContextKey, IReadOnlyDictionary<string, string> Values,
    string? ActorName, string Href);
