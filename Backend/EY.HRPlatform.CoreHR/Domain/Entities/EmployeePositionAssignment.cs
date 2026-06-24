using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>Canonical effective-dated employment position context for an employee.</summary>
public sealed class EmployeePositionAssignment : BaseEntity, ITenantEntity
{
    private EmployeePositionAssignment() { }

    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    /// <summary>
    /// Canonical position for all new assignments. Null is retained only for legacy records
    /// awaiting the explicit cutover command; such records cannot drive Packet A workflow.
    /// </summary>
    public Guid? PositionId { get; private set; }
    public string? LegacyPositionTitle { get; private set; }
    public bool IsPrimary { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveTo { get; private set; }

    public static EmployeePositionAssignment Create(
        Guid tenantId,
        Guid employeeId,
        Guid positionId,
        bool isPrimary,
        DateTime effectiveFrom,
        DateTime? effectiveTo = null)
    {
        if (tenantId == Guid.Empty || employeeId == Guid.Empty || positionId == Guid.Empty)
            throw new ArgumentException("Tenant, employee, and position are required.");
        var from = Normalize(effectiveFrom);
        DateTime? to = effectiveTo.HasValue ? Normalize(effectiveTo.Value) : null;
        if (to.HasValue && to <= from)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveTo));
        return new EmployeePositionAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            PositionId = positionId,
            IsPrimary = isPrimary,
            EffectiveFrom = from,
            EffectiveTo = to,
        };
    }

    internal static EmployeePositionAssignment CreateLegacy(
        Guid tenantId,
        Guid employeeId,
        string legacyPositionTitle,
        bool isPrimary,
        DateTime effectiveFrom,
        DateTime? effectiveTo = null)
    {
        if (string.IsNullOrWhiteSpace(legacyPositionTitle))
            throw new ArgumentException("Legacy position title is required.", nameof(legacyPositionTitle));

        var assignment = Create(tenantId, employeeId, Guid.NewGuid(), isPrimary, effectiveFrom, effectiveTo);
        assignment.PositionId = null;
        assignment.LegacyPositionTitle = legacyPositionTitle.Trim();
        return assignment;
    }

    public bool IsEffectiveOn(DateTime instant)
    {
        var at = Normalize(instant);
        return at >= EffectiveFrom && (!EffectiveTo.HasValue || at < EffectiveTo.Value);
    }

    private static DateTime Normalize(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => throw new ArgumentException("Effective dates must be UTC or local time.")
    };
}
