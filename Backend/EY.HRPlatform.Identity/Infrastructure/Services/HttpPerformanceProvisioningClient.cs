using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Identity.Infrastructure.Services;

public sealed class HttpPerformanceProvisioningClient(
    HttpClient httpClient,
    IInternalServiceRequestSigner signer,
    ILogger<HttpPerformanceProvisioningClient> logger) : IPerformanceProvisioningClient
{
    public async Task ProvisionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"internal/performance/tenants/{tenantId}/provision");
            await signer.SignAsync(request, cancellationToken);
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                logger.LogWarning(
                    "Performance provisioning for tenant {TenantId} returned {StatusCode}",
                    tenantId, (int)response.StatusCode);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Performance provisioning failed for tenant {TenantId}", tenantId);
        }
    }
}
