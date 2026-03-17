namespace EY.HRPlatform.SharedKernel.Multitenancy;

/// <summary>
/// Provides access to the current tenant context for the request.
/// </summary>
public interface ITenantContext
{
    /// <summary>
    /// The current tenant's identifier. Throws if tenant is not resolved.
    /// </summary>
    Guid TenantId { get; }

    /// <summary>
    /// Indicates whether a tenant has been resolved for the current request.
    /// </summary>
    bool IsResolved { get; }

    /// <summary>
    /// Gets the tenant ID if resolved, otherwise null.
    /// </summary>
    Guid? TenantIdOrDefault { get; }
}
