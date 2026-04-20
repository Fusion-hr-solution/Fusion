using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Services;

public sealed record IdentityTenantOperationalStatusDto(
    Guid TenantId,
    string OperationalStatus,
    bool IsActive,
    bool IsArchived);

public interface IIdentityTenantStatusReader
{
    Task<IdentityTenantOperationalStatusDto> GetCurrentTenantStatusAsync(CancellationToken cancellationToken);
}

public sealed class IdentityTenantStatusReader(
    HttpClient httpClient,
    IHttpContextAccessor httpContextAccessor) : IIdentityTenantStatusReader
{
    public async Task<IdentityTenantOperationalStatusDto> GetCurrentTenantStatusAsync(CancellationToken cancellationToken)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No active HTTP context is available for tenant status validation.");

        if (!httpContext.Request.Headers.TryGetValue("Authorization", out var authorizationHeader))
            throw new InvalidOperationException("Authorization header is required for tenant status validation.");

        using var request = new HttpRequestMessage(HttpMethod.Get, "api/identity/tenant-context/organization-status");
        request.Headers.TryAddWithoutValidation("Authorization", authorizationHeader.ToString());

        if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader))
            request.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantHeader.ToString());

        using var response = await httpClient.SendAsync(request, cancellationToken);

        ApiResponse<IdentityTenantOperationalStatusDto>? envelope = null;
        try
        {
            envelope = await response.Content.ReadFromJsonAsync<ApiResponse<IdentityTenantOperationalStatusDto>>(
                cancellationToken: cancellationToken);
        }
        catch
        {
            envelope = null;
        }

        if (!response.IsSuccessStatusCode || envelope?.IsSuccess != true || envelope.Data is null)
        {
            var message = envelope?.Errors.FirstOrDefault() ?? "Unable to validate tenant status with Identity.";
            throw new InvalidOperationException(message);
        }

        return envelope.Data;
    }
}