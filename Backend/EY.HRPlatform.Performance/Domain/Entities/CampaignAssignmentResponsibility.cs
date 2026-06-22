using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An append-only, explicit workflow responsibility. Generated candidates are not authoritative;
/// only a final curated/delegated revision may drive campaign work.
/// </summary>
public class CampaignAssignmentResponsibility : BaseEntity, ITenantEntity
{
    private CampaignAssignmentResponsibility() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public Guid AssigneeEmployeeId { get; private set; }

    /// <summary>Denormalised display name of the assignee captured when the responsibility was curated.</summary>
    public string AssigneeName { get; private set; } = string.Empty;
    public CampaignResponsibilityDuty Duty { get; private set; }
    public CampaignAssignmentSource Source { get; private set; }
    public string RelationshipSource { get; private set; } = string.Empty;
    public string? OverrideReason { get; private set; }
    public bool IsFinal { get; private set; }
    public int Revision { get; private set; }
    public DateTime RecordedAt { get; private set; }

    public static CampaignAssignmentResponsibility Confirm(
        Guid tenantId,
        Guid cycleId,
        Guid subjectEmployeeId,
        Guid assigneeEmployeeId,
        string assigneeName,
        CampaignResponsibilityDuty duty,
        CampaignAssignmentSource source,
        string relationshipSource,
        string? overrideReason = null,
        int revision = 1)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || subjectEmployeeId == Guid.Empty || assigneeEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, campaign, subject, and assignee are required.");
        if (subjectEmployeeId == assigneeEmployeeId)
            throw new DomainRuleViolationException("A person cannot be assigned their own manager responsibility.");
        if (string.IsNullOrWhiteSpace(assigneeName))
            throw new ArgumentException("Assignee name is required.", nameof(assigneeName));
        if (string.IsNullOrWhiteSpace(relationshipSource))
            throw new ArgumentException("Relationship source is required.", nameof(relationshipSource));
        if (revision < 1)
            throw new ArgumentOutOfRangeException(nameof(revision));

        var reason = string.IsNullOrWhiteSpace(overrideReason) ? null : overrideReason.Trim();
        if (reason?.Length > 1000)
            throw new ArgumentException("Override reason cannot exceed 1000 characters.", nameof(overrideReason));

        return new CampaignAssignmentResponsibility
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            SubjectEmployeeId = subjectEmployeeId,
            AssigneeEmployeeId = assigneeEmployeeId,
            AssigneeName = assigneeName.Trim(),
            Duty = duty,
            Source = source,
            RelationshipSource = relationshipSource.Trim(),
            OverrideReason = reason,
            IsFinal = true,
            Revision = revision,
            RecordedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Marks this revision as superseded (no longer the active final revision for its subject+duty).
    /// </summary>
    public void Supersede() => IsFinal = false;
}
