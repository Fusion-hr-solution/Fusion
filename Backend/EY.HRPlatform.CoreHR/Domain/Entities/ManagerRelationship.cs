using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Domain.ValueObjects;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Canonical, effective-dated, tenant-scoped reporting link between a subject
/// <c>WorkAssignment</c> and a manager <c>WorkAssignment</c>. Replaces the position-assignment
/// references the provisional <c>EmployeeReportingRelationship</c> carried. Effective-dated and
/// separate from permissions: an active relationship grants no authorization on its own. Forbids
/// self-management, cross-tenant links, and cycles in the primary management chain.
/// </summary>
public sealed class ManagerRelationship : BaseEntity, ITenantEntity
{
    private ManagerRelationship() { }

    public Guid TenantId { get; private set; }

    public Guid SubjectEmployeeId { get; private set; }
    public Guid ManagerEmployeeId { get; private set; }
    public Guid SubjectWorkAssignmentId { get; private set; }
    public Guid ManagerWorkAssignmentId { get; private set; }

    public ReportingRelationshipType Type { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveTo { get; private set; }

    public WorkforceSourceType Source { get; private set; }
    public string? SourceReference { get; private set; }
    public Guid? ImportBatchId { get; private set; }

    public EffectiveDateRange Interval => EffectiveDateRange.Create(EffectiveFrom, EffectiveTo);
    public bool IsActiveOn(DateTime asOf) => Interval.IsActiveOn(asOf);

    public static ManagerRelationship Create(
        Guid tenantId,
        Guid subjectEmployeeId,
        Guid managerEmployeeId,
        Guid subjectWorkAssignmentId,
        Guid managerWorkAssignmentId,
        ReportingRelationshipType type,
        DateTime effectiveFrom,
        WorkforceSourceType source,
        DateTime? effectiveTo = null,
        string? sourceReference = null,
        Guid? importBatchId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (subjectEmployeeId == Guid.Empty)
            throw new ArgumentException("Subject employee id is required.", nameof(subjectEmployeeId));
        if (managerEmployeeId == Guid.Empty)
            throw new ArgumentException("Manager employee id is required.", nameof(managerEmployeeId));
        if (subjectWorkAssignmentId == Guid.Empty || managerWorkAssignmentId == Guid.Empty)
            throw new ArgumentException("Subject and manager work assignments are required.");
        if (subjectEmployeeId == managerEmployeeId)
            throw new ArgumentException("An employee cannot report to themselves.", nameof(managerEmployeeId));
        if (subjectWorkAssignmentId == managerWorkAssignmentId)
            throw new ArgumentException("Subject and manager work assignments must differ.", nameof(managerWorkAssignmentId));

        var interval = EffectiveDateRange.Create(effectiveFrom, effectiveTo);

        return new ManagerRelationship
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SubjectEmployeeId = subjectEmployeeId,
            ManagerEmployeeId = managerEmployeeId,
            SubjectWorkAssignmentId = subjectWorkAssignmentId,
            ManagerWorkAssignmentId = managerWorkAssignmentId,
            Type = type,
            EffectiveFrom = interval.EffectiveFrom,
            EffectiveTo = interval.EffectiveTo,
            Source = source,
            SourceReference = sourceReference?.Trim(),
            ImportBatchId = importBatchId,
        };
    }

    /// <summary>Closes this relationship effective the given date (close-and-succeed convention).</summary>
    public void End(DateTime effectiveDate)
    {
        var closed = Interval.CloseAt(effectiveDate);
        EffectiveTo = closed.EffectiveTo;
        UpdatedAt = DateTime.UtcNow;
    }
}
