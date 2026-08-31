using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Identity.Infrastructure.Core;

/// <summary>
/// A canonical CoreHR Employee fact resolved for exactly one tenant. CoreHR is the
/// only authority for Employee existence, tenant ownership, work email, and active
/// state; Identity never accepts these facts from a browser. Resolution under a
/// tenant scope is itself the ownership proof: CoreHR returns an Employee only when
/// it belongs to the tenant carried in <c>X-Tenant-Id</c>.
/// </summary>
public sealed record CoreEmployeeFacts(
    Guid EmployeeId,
    string DisplayName,
    string FullName,
    string? WorkEmail,
    bool IsActive);

/// <summary>
/// Resolves canonical CoreHR Employee facts over the signed internal snapshot
/// contract. Used by the binding backfill to prove which tenant owns a legacy
/// Employee, and by workforce-access flows to re-resolve the canonical subject
/// before an authoritative mutation.
/// </summary>
public interface ICoreWorkforceDirectory
{
    /// <summary>
    /// Returns, for the given Employee IDs, only those the tenant actually owns,
    /// keyed by Employee ID. An empty result means CoreHR did not confirm ownership
    /// (missing Employee, wrong tenant, or trusted dependency unavailable — the
    /// caller fails closed rather than guessing).
    /// </summary>
    Task<IReadOnlyDictionary<Guid, CoreEmployeeFacts>> ResolveOwnedEmployeesAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> employeeIds,
        DateTime asOf,
        CancellationToken cancellationToken);
}

public sealed class CoreWorkforceDirectory(
    HttpClient httpClient,
    IInternalServiceRequestSigner signer) : ICoreWorkforceDirectory
{
    private const string ResolvePath = "internal/corehr/workforce/snapshots/resolve";

    public async Task<IReadOnlyDictionary<Guid, CoreEmployeeFacts>> ResolveOwnedEmployeesAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> employeeIds,
        DateTime asOf,
        CancellationToken cancellationToken)
    {
        if (tenantId == Guid.Empty || employeeIds.Count == 0)
        {
            return new Dictionary<Guid, CoreEmployeeFacts>();
        }

        // Sign against an absolute URI so the signed path keeps its leading slash
        // and matches the server's request path exactly (a relative URI would drop
        // it and fail HMAC verification).
        var requestUri = httpClient.BaseAddress is not null
            ? new Uri(httpClient.BaseAddress, ResolvePath)
            : new Uri(ResolvePath, UriKind.Relative);

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(new ResolveRequest(asOf, employeeIds.Distinct().ToList())),
        };
        request.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId.ToString());

        await signer.SignAsync(request, cancellationToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var snapshots = await response.Content
            .ReadFromJsonAsync<List<SnapshotDto>>(cancellationToken: cancellationToken) ?? [];

        return snapshots
            .Where(snapshot => snapshot.EmployeeId != Guid.Empty)
            .GroupBy(snapshot => snapshot.EmployeeId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var first = group.First();
                    return new CoreEmployeeFacts(
                        first.EmployeeId,
                        first.DisplayName ?? string.Empty,
                        first.FullName ?? string.Empty,
                        string.IsNullOrWhiteSpace(first.WorkEmail) ? null : first.WorkEmail,
                        first.IsActive);
                });
    }

    private sealed record ResolveRequest(DateTime AsOf, IReadOnlyList<Guid> EmployeeIds);

    // Mirrors CoreHR's InternalWorkforceEmployeeSnapshotDto by JSON property name.
    private sealed record SnapshotDto(
        Guid EmployeeId,
        string? StableEmployeeKey,
        string? FullName,
        string? DisplayName,
        string? WorkEmail,
        string? JobTitle,
        bool IsActive);
}
