using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EvaluationRoundExclusion : BaseEntity, ITenantEntity
{
    public const int ReasonMaxLength = 500;

    private EvaluationRoundExclusion() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid ParticipantEmployeeId { get; private set; }
    public string ParticipantName { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;

    internal static EvaluationRoundExclusion Create(
        Guid tenantId,
        Guid roundId,
        Guid participantEmployeeId,
        string participantName,
        string reason)
    {
        if (participantEmployeeId == Guid.Empty)
            throw new ArgumentException("Participant is required.", nameof(participantEmployeeId));
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("An exclusion reason is required.");

        var normalizedReason = reason.Trim();
        if (normalizedReason.Length > ReasonMaxLength)
            throw new ArgumentException($"Reason cannot exceed {ReasonMaxLength} characters.", nameof(reason));

        return new EvaluationRoundExclusion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            ParticipantEmployeeId = participantEmployeeId,
            ParticipantName = string.IsNullOrWhiteSpace(participantName) ? "(unknown)" : participantName.Trim(),
            Reason = normalizedReason
        };
    }
}

public sealed class EvaluationRoundReviewerCorrection : BaseEntity, ITenantEntity
{
    public const int ReasonMaxLength = 500;

    private EvaluationRoundReviewerCorrection() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid ParticipantEmployeeId { get; private set; }
    public Guid ReviewerEmployeeId { get; private set; }
    public string ReviewerName { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;

    internal static EvaluationRoundReviewerCorrection Create(
        Guid tenantId,
        Guid roundId,
        Guid participantEmployeeId,
        Guid reviewerEmployeeId,
        string reviewerName,
        string reason)
    {
        if (participantEmployeeId == Guid.Empty)
            throw new ArgumentException("Participant is required.", nameof(participantEmployeeId));
        if (reviewerEmployeeId == Guid.Empty)
            throw new DomainRuleViolationException("A corrected reviewer is required.");
        if (string.IsNullOrWhiteSpace(reviewerName))
            throw new DomainRuleViolationException("A corrected reviewer name is required.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("A reviewer-correction reason is required.");

        var normalizedReason = reason.Trim();
        if (normalizedReason.Length > ReasonMaxLength)
            throw new ArgumentException($"Reason cannot exceed {ReasonMaxLength} characters.", nameof(reason));

        return new EvaluationRoundReviewerCorrection
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            ParticipantEmployeeId = participantEmployeeId,
            ReviewerEmployeeId = reviewerEmployeeId,
            ReviewerName = reviewerName.Trim(),
            Reason = normalizedReason
        };
    }
}

public sealed class EvaluationRoundDeadlineExtension : BaseEntity, ITenantEntity
{
    public const int ReasonMaxLength = 500;

    private EvaluationRoundDeadlineExtension() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public EvaluationDeadlineKind DeadlineKind { get; private set; }
    public DateTime PreviousDeadline { get; private set; }
    public DateTime NewDeadline { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public Guid ActorUserId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public DateTime OccurredAt { get; private set; }

    internal static EvaluationRoundDeadlineExtension Create(
        Guid tenantId,
        Guid roundId,
        EvaluationDeadlineKind deadlineKind,
        DateTime previousDeadline,
        DateTime newDeadline,
        string reason,
        Guid actorUserId,
        string actorName,
        DateTime occurredAt)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainRuleViolationException("A deadline-extension reason is required.");
        if (actorUserId == Guid.Empty)
            throw new ArgumentException("Actor is required.", nameof(actorUserId));

        var normalizedReason = reason.Trim();
        if (normalizedReason.Length > ReasonMaxLength)
            throw new ArgumentException($"Reason cannot exceed {ReasonMaxLength} characters.", nameof(reason));

        return new EvaluationRoundDeadlineExtension
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            DeadlineKind = deadlineKind,
            PreviousDeadline = previousDeadline,
            NewDeadline = newDeadline,
            Reason = normalizedReason,
            ActorUserId = actorUserId,
            ActorName = string.IsNullOrWhiteSpace(actorName) ? "(unknown)" : actorName.Trim(),
            OccurredAt = occurredAt
        };
    }
}
