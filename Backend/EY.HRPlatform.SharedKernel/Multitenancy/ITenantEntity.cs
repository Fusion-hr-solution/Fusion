namespace EY.HRPlatform.SharedKernel.Multitenancy;

/// <summary>
/// Marker interface for entities that belong to a tenant.
/// Used by the TenantSaveChangesInterceptor to validate write operations across all tenant-scoped entities.
/// </summary>
public interface ITenantEntity
{
    /// <summary>
    /// The tenant this entity belongs to.
    /// </summary>
    Guid TenantId { get; }
}
