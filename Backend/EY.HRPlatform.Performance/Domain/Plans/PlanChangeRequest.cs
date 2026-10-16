using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Plans;

public enum PlanChangeRequestState { Open = 0, Addressed = 1, ObjectiveRemoved = 2 }

/// <summary>
/// One change the reviewer asked for on a specific objective when returning a plan (D-09). It belongs to
/// the return that carried it and stays in the plan's decision history; it is never edited or deleted.
/// The objective is referenced without a foreign key and its title is kept, because a Draft objective
/// can be removed — which itself addresses the request.
/// </summary>
public sealed class PlanChangeRequest : PerformanceChildEntity
{
    public const int MaxTextLength = 500;

    private PlanChangeRequest() { }

    public Guid DecisionId { get; private set; }
    public Guid ObjectiveId { get; private set; }
    public string ObjectiveTitle { get; private set; } = string.Empty;
    public string Text { get; private set; } = string.Empty;
    public PlanChangeRequestState State { get; private set; }
    public string? Reply { get; private set; }
    public DateTime? AddressedAt { get; private set; }

    public bool IsOpen => State == PlanChangeRequestState.Open;

    internal static PlanChangeRequest Create(Guid tenantId, Guid objectiveId, string objectiveTitle, string text)
    {
        if (objectiveId == Guid.Empty) throw new ArgumentException("A change request targets an objective.", nameof(objectiveId));
        var cleaned = text?.Trim() ?? string.Empty;
        if (cleaned.Length == 0) throw new ArgumentException("Say what needs to change.", nameof(text));
        if (cleaned.Length > MaxTextLength)
            throw new ArgumentException($"Keep each change request to {MaxTextLength} characters.", nameof(text));
        return new PlanChangeRequest
        {
            TenantId = tenantId,
            ObjectiveId = objectiveId,
            ObjectiveTitle = objectiveTitle,
            Text = cleaned,
            State = PlanChangeRequestState.Open,
        };
    }

    internal void AttachTo(Guid decisionId) => DecisionId = decisionId;

    /// <summary>The owner marks it addressed, optionally replying. False when it already was.</summary>
    internal bool Address(string? reply, DateTime at)
    {
        if (!IsOpen) return false;
        var cleaned = string.IsNullOrWhiteSpace(reply) ? null : reply.Trim();
        if (cleaned is { Length: > MaxTextLength })
            throw new ArgumentException($"Keep the reply to {MaxTextLength} characters.", nameof(reply));
        State = PlanChangeRequestState.Addressed;
        Reply = cleaned;
        AddressedAt = at;
        MarkUpdated();
        return true;
    }

    internal bool ObjectiveWasRemoved(DateTime at)
    {
        if (!IsOpen) return false;
        State = PlanChangeRequestState.ObjectiveRemoved;
        AddressedAt = at;
        MarkUpdated();
        return true;
    }
}
