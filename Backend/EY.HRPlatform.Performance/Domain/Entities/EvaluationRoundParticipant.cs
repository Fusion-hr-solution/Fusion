using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>Frozen round membership and reviewer relationship captured at launch.</summary>
public sealed class EvaluationRoundParticipant : BaseEntity, ITenantEntity
{
    private EvaluationRoundParticipant() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid CampaignParticipantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string? EmployeeKey { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public Guid? OrgUnitId { get; private set; }
    public string? OrgUnitName { get; private set; }
    public string? JobTitle { get; private set; }
    public Guid ReviewerEmployeeId { get; private set; }
    public string ReviewerName { get; private set; } = string.Empty;
    public Guid? ObjectivePlanSnapshotId { get; private set; }
    public DateTime SnapshotAt { get; private set; }

    internal static EvaluationRoundParticipant Capture(
        Guid tenantId,
        Guid roundId,
        EvaluationRoundLaunchCandidate candidate,
        Guid reviewerEmployeeId,
        string reviewerName,
        Guid? objectivePlanSnapshotId,
        DateTime snapshotAt) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            CampaignParticipantId = candidate.Participant.Id,
            EmployeeId = candidate.Participant.EmployeeId,
            EmployeeKey = candidate.Participant.EmployeeKey,
            FullName = candidate.Participant.FullName,
            Email = candidate.Participant.Email,
            OrgUnitId = candidate.Participant.OrgUnitId,
            OrgUnitName = candidate.Participant.OrgUnitName,
            JobTitle = candidate.Participant.JobTitle,
            ReviewerEmployeeId = reviewerEmployeeId,
            ReviewerName = reviewerName,
            ObjectivePlanSnapshotId = objectivePlanSnapshotId,
            SnapshotAt = snapshotAt
        };
}

public sealed record EvaluationRoundLaunchCandidate(
    PerformanceCycleParticipant Participant,
    Guid EffectiveReviewerEmployeeId,
    string EffectiveReviewerName,
    EmployeeObjectivePlan? ApprovedObjectivePlan = null);
