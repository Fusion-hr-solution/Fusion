using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Tenant-owned position in the organisational design. Employee assignments reference this
/// record; free-text job titles are never used as position identity.
/// </summary>
public sealed class Position : AggregateRoot, ITenantEntity
{
    private Position() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public Guid? OrgUnitId { get; private set; }
    public bool IsActive { get; private set; }

    public static Position Create(Guid tenantId, string code, string title, Guid? orgUnitId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Position code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Position title is required.", nameof(title));

        var normalizedCode = code.Trim().ToUpperInvariant();
        if (normalizedCode.Length > 64)
            throw new ArgumentException("Position code cannot exceed 64 characters.", nameof(code));
        var normalizedTitle = title.Trim();
        if (normalizedTitle.Length > 150)
            throw new ArgumentException("Position title cannot exceed 150 characters.", nameof(title));

        return new Position
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = normalizedCode,
            Title = normalizedTitle,
            OrgUnitId = orgUnitId == Guid.Empty ? null : orgUnitId,
            IsActive = true,
        };
    }

    public void Update(string title, Guid? orgUnitId)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Position title is required.", nameof(title));

        var normalizedTitle = title.Trim();
        if (normalizedTitle.Length > 150)
            throw new ArgumentException("Position title cannot exceed 150 characters.", nameof(title));

        Title = normalizedTitle;
        OrgUnitId = orgUnitId == Guid.Empty ? null : orgUnitId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (!IsActive)
            throw new InvalidOperationException("Position is already inactive.");

        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
