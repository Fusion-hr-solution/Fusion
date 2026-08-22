using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Performance.Infrastructure.Core;

/// <summary>
/// Reads Core workforce/organization truth through the signed internal snapshot contract.
/// All three population resolution modes go through here: all-active-as-of (mode A),
/// by-scope (mode B), and resolve-by-ids (named). Every call is HMAC-signed and carries the
/// current tenant via <c>X-Tenant-Id</c>.
/// </summary>
public interface ICoreWorkforceClient
{
    Task<IReadOnlyList<WorkforceSnapshot>> GetAllActiveAsOfAsync(DateTime asOf, CancellationToken cancellationToken);

    Task<IReadOnlyList<WorkforceSnapshot>> GetByScopeAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<WorkforceSnapshot>> ResolveAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken);
}

public sealed class CoreWorkforceClient(
    HttpClient httpClient,
    IInternalServiceRequestSigner signer,
    ITenantContext tenantContext) : ICoreWorkforceClient
{
    private const string BasePath = "internal/corehr/workforce/snapshots";

    public Task<IReadOnlyList<WorkforceSnapshot>> GetAllActiveAsOfAsync(DateTime asOf, CancellationToken cancellationToken)
        => PostAsync($"{BasePath}/all-active", new WorkforceAllActiveRequest(asOf), cancellationToken);

    public Task<IReadOnlyList<WorkforceSnapshot>> GetByScopeAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        CancellationToken cancellationToken)
    {
        if (orgUnitIds.Count == 0)
            return Task.FromResult<IReadOnlyList<WorkforceSnapshot>>([]);

        return PostAsync(
            $"{BasePath}/by-scope",
            new WorkforceByScopeRequest(asOf, orgUnitIds.ToList(), includeDescendants),
            cancellationToken);
    }

    public Task<IReadOnlyList<WorkforceSnapshot>> ResolveAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
            return Task.FromResult<IReadOnlyList<WorkforceSnapshot>>([]);

        return PostAsync(
            $"{BasePath}/resolve",
            new WorkforceResolveRequest(asOf, employeeIds.ToList()),
            cancellationToken);
    }

    private async Task<IReadOnlyList<WorkforceSnapshot>> PostAsync<TRequest>(
        string path,
        TRequest body,
        CancellationToken cancellationToken)
    {
        if (!tenantContext.IsResolved)
            throw new InvalidOperationException("A resolved tenant context is required to read Core workforce truth.");

        // Sign against an absolute URI so the signed path carries its leading slash and matches
        // the server's request path exactly; signing a relative URI would drop the slash and
        // fail HMAC verification.
        var requestUri = httpClient.BaseAddress is not null ? new Uri(httpClient.BaseAddress, path) : new Uri(path, UriKind.Relative);
        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantContext.TenantId.ToString());

        await signer.SignAsync(request, cancellationToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var snapshots = await response.Content.ReadFromJsonAsync<List<WorkforceSnapshot>>(cancellationToken: cancellationToken);
        return snapshots ?? [];
    }
}
