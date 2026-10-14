using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Performance.Infrastructure.Identity;

/// <summary>
/// Asks Identity, over the signed internal contract, which accounts of the current tenant hold
/// a permission. Performance only sees the caller's own token, so naming another user by
/// capability has to be verified here.
/// </summary>
public interface IPermissionHoldersClient
{
    Task<IReadOnlyList<PermissionHolder>> GetHoldersAsync(string permissionKey, string scope, CancellationToken cancellationToken);
}

public sealed class PermissionHoldersClient(
    HttpClient httpClient,
    IInternalServiceRequestSigner signer,
    ITenantContext tenantContext) : IPermissionHoldersClient
{
    public async Task<IReadOnlyList<PermissionHolder>> GetHoldersAsync(string permissionKey, string scope, CancellationToken cancellationToken)
    {
        if (!tenantContext.IsResolved)
            throw new InvalidOperationException("A resolved tenant context is required to read permission holders.");

        // Signed against the absolute URI so the signed path keeps its leading slash.
        var requestUri = new Uri(httpClient.BaseAddress!, "internal/identity/access/permission-holders");
        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(new PermissionHoldersRequest(tenantContext.TenantId, permissionKey, scope)),
        };
        await signer.SignAsync(request, cancellationToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<PermissionHolder>>(cancellationToken) ?? [];
    }
}
