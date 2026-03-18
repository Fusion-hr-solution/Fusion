namespace EY.HRPlatform.SharedKernel.Multitenancy;

/// <summary>
/// Scoped service that holds the resolved tenant for the current request.
/// Set by middleware, consumed by DbContext and other services.
/// </summary>
public sealed class TenantContext : ITenantContext
{
    private Guid? _tenantId;

    public Guid TenantId => _tenantId ?? throw new InvalidOperationException(
        "Tenant context not resolved. Ensure tenant resolution middleware is registered and the request includes tenant information.");

    public bool IsResolved => _tenantId.HasValue;

    public Guid? TenantIdOrDefault => _tenantId;

    /// <summary>
    /// Sets the tenant for the current request scope. Can only be called once per request.
    /// </summary>
    public void SetTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID cannot be empty.", nameof(tenantId));

        if (_tenantId.HasValue)
            throw new InvalidOperationException("Tenant context has already been set for this request.");

        _tenantId = tenantId;
    }
}
