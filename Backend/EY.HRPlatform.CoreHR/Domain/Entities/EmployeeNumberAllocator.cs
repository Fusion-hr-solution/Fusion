using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Tenant-scoped persistence state for generated Employee Numbers. The stored value is an
/// implementation sequence only; it carries no business meaning and gaps are valid.
/// </summary>
public sealed class EmployeeNumberAllocator : ITenantEntity
{
    private EmployeeNumberAllocator() { }

    public Guid TenantId { get; private set; }
    public long NextValue { get; private set; }

    public static EmployeeNumberAllocator Create(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));

        return new EmployeeNumberAllocator { TenantId = tenantId, NextValue = 1 };
    }

    public long TakeNext()
    {
        if (NextValue < 1 || NextValue == long.MaxValue)
            throw new InvalidOperationException("The Employee Number allocator is exhausted or invalid.");

        return NextValue++;
    }
}
