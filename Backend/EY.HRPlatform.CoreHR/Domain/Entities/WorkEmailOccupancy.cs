using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Database enforcement state for the one active/scheduled owner of a normalized work email.
/// This is not canonical email history; Employment remains the authority for whether a claim exists.
/// </summary>
public sealed class WorkEmailOccupancy : BaseEntity, ITenantEntity
{
    private WorkEmailOccupancy() { }

    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string NormalizedEmail { get; private set; } = string.Empty;

    public static WorkEmailOccupancy Create(Guid tenantId, Guid employeeId, string normalizedEmail)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (employeeId == Guid.Empty)
            throw new ArgumentException("Employee id is required.", nameof(employeeId));

        return new WorkEmailOccupancy
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            NormalizedEmail = Normalize(normalizedEmail),
        };
    }

    public void MoveTo(string normalizedEmail)
    {
        NormalizedEmail = Normalize(normalizedEmail);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string Normalize(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("A work-email occupancy requires an email.", nameof(value));

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > 256)
            throw new ArgumentException("Work email cannot exceed 256 characters.", nameof(value));

        return normalized;
    }
}
