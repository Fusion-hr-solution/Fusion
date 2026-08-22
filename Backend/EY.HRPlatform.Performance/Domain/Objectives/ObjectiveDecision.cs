using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Objectives;

/// <summary>
/// One attributable step in an organizational objective's approval history: who acted, what they
/// did, and (for a return) the required feedback. Append-only; the context panel reads it to show
/// the decision trail (product-spec §17).
/// </summary>
public sealed class ObjectiveDecision : PerformanceChildEntity
{
    private ObjectiveDecision() { }

    public Guid ObjectiveId { get; private set; }
    public ObjectiveDecisionKind Kind { get; private set; }
    public Guid ActorEmployeeId { get; private set; }
    public string? Feedback { get; private set; }
    public DateTime DecidedAt { get; private set; }

    public static ObjectiveDecision Record(Guid tenantId, ObjectiveDecisionKind kind, Guid actorEmployeeId, string? feedback)
        => new()
        {
            TenantId = tenantId,
            Kind = kind,
            ActorEmployeeId = actorEmployeeId,
            Feedback = string.IsNullOrWhiteSpace(feedback) ? null : feedback.Trim(),
            DecidedAt = DateTime.UtcNow,
        };

    internal void AttachTo(Guid objectiveId) => ObjectiveId = objectiveId;
}
