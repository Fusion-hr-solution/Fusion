namespace EY.HRPlatform.Identity.Infrastructure.Services;

/// <summary>
/// Service-to-service client for the Performance microservice provisioning endpoint.
/// Called after a new tenant is committed to initialize the tenant's performance configuration.
/// </summary>
public interface IPerformanceProvisioningClient
{
    /// <summary>
    /// Provisions performance configuration (policy + starter templates) for a newly created tenant.
    /// Idempotent: safe to call multiple times for the same tenant.
    /// </summary>
    Task ProvisionAsync(Guid tenantId, CancellationToken cancellationToken = default);
}

/// <summary>No-op fallback when Performance service URL is not configured.</summary>
public sealed class NoOpPerformanceProvisioningClient : IPerformanceProvisioningClient
{
    public Task ProvisionAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
