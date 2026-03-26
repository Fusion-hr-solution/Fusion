using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Stores tenant-specific configuration overrides.
/// Settings not present in SettingsOverrides use platform defaults.
/// </summary>
public class TenantSettings : BaseEntity, ITenantEntity
{
    private TenantSettings() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }

    /// <summary>
    /// JSON string containing tenant-specific setting overrides.
    /// Null or empty means tenant uses all platform defaults.
    /// Stored as JSONB in PostgreSQL for efficient querying.
    /// </summary>
    public string? SettingsOverrides { get; private set; }

    /// <summary>
    /// Creates a new TenantSettings instance for the specified tenant.
    /// </summary>
    public static TenantSettings Create(Guid tenantId, string? settingsOverrides = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        return new TenantSettings
        {
            TenantId = tenantId,
            SettingsOverrides = settingsOverrides
        };
    }

    /// <summary>
    /// Updates the settings overrides JSON.
    /// </summary>
    public void UpdateOverrides(string? settingsOverrides)
    {
        SettingsOverrides = settingsOverrides;
        UpdatedAt = DateTime.UtcNow;
    }
}
