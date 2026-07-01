using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Effective-dated reporting context owned by Core. This replaces workflow reliance
/// on Employee.ManagerId; contextual relationships remain explicit rather than being
/// folded into the primary management chain.
/// </summary>
public class EmployeeReportingRelationship : BaseEntity, ITenantEntity
{
    private EmployeeReportingRelationship() { }

    public Guid TenantId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public Guid ManagerEmployeeId { get; private set; }
    public Guid SubjectPositionAssignmentId { get; private set; }
    public Guid ManagerPositionAssignmentId { get; private set; }
    public ReportingRelationshipType Type { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveTo { get; private set; }

    public static EmployeeReportingRelationship Create(
        Guid tenantId,
        Guid subjectEmployeeId,
        Guid managerEmployeeId,
        Guid subjectPositionAssignmentId,
        Guid managerPositionAssignmentId,
        ReportingRelationshipType type,
        DateTime effectiveFrom,
        DateTime? effectiveTo = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (subjectEmployeeId == Guid.Empty)
            throw new ArgumentException("Subject employee id is required.", nameof(subjectEmployeeId));
        if (managerEmployeeId == Guid.Empty)
            throw new ArgumentException("Manager employee id is required.", nameof(managerEmployeeId));
        if (subjectPositionAssignmentId == Guid.Empty || managerPositionAssignmentId == Guid.Empty)
            throw new ArgumentException("Subject and manager position assignments are required.");
        if (subjectEmployeeId == managerEmployeeId)
            throw new ArgumentException("An employee cannot report to themselves.", nameof(managerEmployeeId));

        var from = NormalizeUtc(effectiveFrom, nameof(effectiveFrom));
        DateTime? to = effectiveTo.HasValue ? NormalizeUtc(effectiveTo.Value, nameof(effectiveTo)) : null;
        if (to.HasValue && to <= from)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveTo));

        return new EmployeeReportingRelationship
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SubjectEmployeeId = subjectEmployeeId,
            ManagerEmployeeId = managerEmployeeId,
            SubjectPositionAssignmentId = subjectPositionAssignmentId,
            ManagerPositionAssignmentId = managerPositionAssignmentId,
            Type = type,
            EffectiveFrom = from,
            EffectiveTo = to
        };
    }

    public bool IsEffectiveOn(DateTime instant)
    {
        var utcInstant = NormalizeUtc(instant, nameof(instant));
        return utcInstant >= EffectiveFrom && (!EffectiveTo.HasValue || utcInstant < EffectiveTo.Value);
    }

    private static DateTime NormalizeUtc(DateTime value, string parameterName)
    {
        if (value == default)
            throw new ArgumentException("A valid effective date is required.", parameterName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => throw new ArgumentException("Effective dates must be UTC or local time.", parameterName)
        };
    }
}
