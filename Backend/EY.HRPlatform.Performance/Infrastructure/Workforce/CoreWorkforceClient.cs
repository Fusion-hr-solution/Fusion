using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

public interface ICoreWorkforceClient
{
    /// <summary>Resolves a set of Core employee ids to their current summaries (scope-filtered by Core).</summary>
    Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken);

    /// <summary>Lists employees within the given org units (optionally descendants), scope-filtered by Core.</summary>
    Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<CoreEmployeeSummary>> GetManagerChainAsync(
        Guid employeeId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Returns the org-unit detail including ResponsibleManagerEmployeeId.
    /// Returns null when the org unit is not found or not visible (404).
    /// Throws <see cref="InvalidOperationException"/> on other non-success responses.
    /// </summary>
    Task<CoreOrgUnitDetail?> GetOrgUnitAsync(Guid orgUnitId, CancellationToken cancellationToken);

    /// <summary>
    /// Returns the effective-today members of the given org unit, optionally including descendants.
    /// </summary>
    Task<IReadOnlyList<CoreEmployeeSummary>> GetOrgUnitMembersAsync(Guid orgUnitId, bool includeDescendants, CancellationToken cancellationToken);
}

/// <summary>
/// HTTP client over the Core workforce contract (/api/corehr/workforce/*). The caller's bearer
/// token is forwarded by <see cref="BearerTokenForwardingHandler"/> so Core applies the caller's
/// visibility scope. Performance never reads Core's database directly.
/// </summary>
public sealed class CoreWorkforceClient(HttpClient httpClient) : ICoreWorkforceClient
{
    public async Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        var response = await httpClient.PostAsJsonAsync(
            "api/corehr/workforce/employees/resolve",
            new { employeeIds },
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        if (orgUnitIds.Count == 0)
        {
            return [];
        }

        var response = await httpClient.PostAsJsonAsync(
            "api/corehr/workforce/employees/by-scope",
            new { orgUnitIds, includeDescendants, includeInactive },
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetManagerChainAsync(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        var response = await httpClient.GetAsync(
            $"api/corehr/workforce/employees/{employeeId}/manager-chain",
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<CoreOrgUnitDetail?> GetOrgUnitAsync(Guid orgUnitId, CancellationToken cancellationToken)
    {
        var response = await httpClient.GetAsync(
            $"api/corehr/workforce/org-units/{orgUnitId}",
            cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Core org-unit request failed with status {(int)response.StatusCode}.");
        }

        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<CoreOrgUnitDetail>>(cancellationToken);
        return payload?.Data;
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetOrgUnitMembersAsync(
        Guid orgUnitId,
        bool includeDescendants,
        CancellationToken cancellationToken)
    {
        var response = await httpClient.GetAsync(
            $"api/corehr/workforce/org-units/{orgUnitId}/members?includeDescendants={includeDescendants}",
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    private static async Task<IReadOnlyList<CoreEmployeeSummary>> ReadEmployeesAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Core workforce request failed with status {(int)response.StatusCode}.");
        }

        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<List<CoreEmployeeSummary>>>(cancellationToken);
        return payload?.Data ?? [];
    }
}
