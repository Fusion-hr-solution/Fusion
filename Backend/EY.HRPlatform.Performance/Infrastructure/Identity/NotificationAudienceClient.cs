using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Notifications;
using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Performance.Infrastructure.Identity;

/// <summary>
/// Asks Identity, over the signed internal contract, for the current tenant's name and time zone and each recipient's
/// account language (B-002 N12). Performance keeps no copy, so a language switch applies to the next email.
/// </summary>
public interface INotificationAudienceClient
{
    Task<NotificationAudience> ReadAsync(IReadOnlyList<Guid> employeeIds, CancellationToken cancellationToken);
}

public sealed class NotificationAudienceClient(
    HttpClient httpClient,
    IInternalServiceRequestSigner signer,
    ITenantContext tenantContext) : INotificationAudienceClient
{
    public async Task<NotificationAudience> ReadAsync(IReadOnlyList<Guid> employeeIds, CancellationToken cancellationToken)
    {
        if (!tenantContext.IsResolved)
            throw new InvalidOperationException("A resolved tenant context is required to read a notification audience.");

        // Signed against the absolute URI so the signed path keeps its leading slash.
        var requestUri = new Uri(httpClient.BaseAddress!, "internal/identity/notification-audience");
        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(new NotificationAudienceRequest(tenantContext.TenantId, employeeIds)),
        };
        await signer.SignAsync(request, cancellationToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<NotificationAudience>(cancellationToken)
            ?? throw new InvalidOperationException("Identity returned no notification audience.");
    }
}
