using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

public interface ICoreWorkforceClient
{
    /// <summary>Resolves a set of Core employee ids to their current summaries (scope-filtered by Core).</summary>
    Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsOfAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Lists every active employee visible to the caller (the all-active population baseline).
    /// Pages through the Core workforce search contract; scope-filtered by Core.
    /// </summary>
    Task<IReadOnlyList<CoreEmployeeSummary>> GetAllActiveEmployeesAsync(
        bool includeInactive,
        CancellationToken cancellationToken);

    /// <summary>Lists employees within the given org units (optionally descendants), scope-filtered by Core.</summary>
    Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsync(
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsOfAsync(
        DateTime asOf,
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

    /// <summary>
    /// Returns the richer canonical campaign workforce context from Core as of a given date.
    /// </summary>
    Task<CoreCampaignWorkforceContext> GetCampaignWorkforceContextAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Returns org-unit list + distinct job-title / work-location / employment-type values
    /// scoped to the caller's tenant. Used by Performance to populate applicability pickers.
    /// </summary>
    Task<CoreApplicabilityOptions> GetApplicabilityOptionsAsync(CancellationToken cancellationToken);
}

/// <summary>
/// HTTP client over the Core workforce contract (/api/corehr/workforce/*). The caller's bearer
/// token is forwarded by <see cref="BearerTokenForwardingHandler"/> so Core applies the caller's
/// visibility scope. Performance never reads Core's database directly.
/// </summary>
public sealed class CoreWorkforceClient(
    HttpClient httpClient,
    IInternalServiceRequestSigner internalServiceRequestSigner) : ICoreWorkforceClient
{
    public async Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsync(
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        var response = await GuardAsync(
            () => httpClient.PostAsJsonAsync(
                "api/corehr/workforce/employees/resolve",
                new { employeeIds },
                cancellationToken),
            "employee resolve",
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetAllActiveEmployeesAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        const int pageSize = 100;
        var accumulated = new List<CoreEmployeeSummary>();
        var page = 1;

        while (true)
        {
            var response = await GuardAsync(
                () => httpClient.GetAsync(
                    $"api/corehr/workforce/employees/search?page={page}&pageSize={pageSize}",
                    cancellationToken),
                "workforce search",
                cancellationToken);

            EnsureAnswered(response, "workforce");

            var payload = await response.Content
                .ReadFromJsonAsync<ApiResponse<PagedEmployeeResponse>>(cancellationToken);
            var pageResult = payload?.Data;
            var items = pageResult?.Items ?? [];
            accumulated.AddRange(items);

            if (items.Count < pageSize || (pageResult is not null && page >= pageResult.TotalPages))
            {
                break;
            }

            page++;
        }

        var filtered = includeInactive
            ? accumulated
            : accumulated.Where(employee => employee.IsActive).ToList();

        return filtered
            .GroupBy(employee => employee.EmployeeId)
            .Select(group => group.First())
            .ToList();
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

        var response = await GuardAsync(
            () => httpClient.PostAsJsonAsync(
                "api/corehr/workforce/employees/by-scope",
                new { orgUnitIds, includeDescendants, includeInactive },
                cancellationToken),
            "employees by scope",
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetManagerChainAsync(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        var response = await GuardAsync(
            () => httpClient.GetAsync(
                $"api/corehr/workforce/employees/{employeeId}/manager-chain",
                cancellationToken),
            "manager chain",
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<CoreOrgUnitDetail?> GetOrgUnitAsync(Guid orgUnitId, CancellationToken cancellationToken)
    {
        var response = await GuardAsync(
            () => httpClient.GetAsync(
                $"api/corehr/workforce/org-units/{orgUnitId}",
                cancellationToken),
            "org unit",
            cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        EnsureAnswered(response, "org-unit");

        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<CoreOrgUnitDetail>>(cancellationToken);
        return payload?.Data;
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetOrgUnitMembersAsync(
        Guid orgUnitId,
        bool includeDescendants,
        CancellationToken cancellationToken)
    {
        var response = await GuardAsync(
            () => httpClient.GetAsync(
                $"api/corehr/workforce/org-units/{orgUnitId}/members?includeDescendants={includeDescendants}",
                cancellationToken),
            "org-unit members",
            cancellationToken);

        return await ReadEmployeesAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> GetEmployeesByScopeAsOfAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> orgUnitIds,
        bool includeDescendants,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        if (orgUnitIds.Count == 0)
        {
            return [];
        }

        // All internal paths are root-relative (leading slash): the request is signed before the
        // HttpClient resolves BaseAddress, and the CoreHR authorizer verifies the absolute path.
        using var request = new HttpRequestMessage(HttpMethod.Post, "/internal/corehr/workforce/snapshots/by-scope")
        {
            Content = JsonContent.Create(new
            {
                asOf,
                orgUnitIds,
                includeDescendants,
                includeInactive
            })
        };

        await internalServiceRequestSigner.SignAsync(request, cancellationToken);
        using var response = await GuardAsync(
            () => httpClient.SendAsync(request, cancellationToken),
            "workforce snapshot by scope",
            cancellationToken);
        return await ReadInternalEmployeesAsync(response, cancellationToken);
    }

    public async Task<IReadOnlyList<CoreEmployeeSummary>> ResolveEmployeesAsOfAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        if (employeeIds.Count == 0)
        {
            return [];
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "/internal/corehr/workforce/snapshots/resolve")
        {
            Content = JsonContent.Create(new
            {
                asOf,
                employeeIds
            })
        };

        await internalServiceRequestSigner.SignAsync(request, cancellationToken);
        using var response = await GuardAsync(
            () => httpClient.SendAsync(request, cancellationToken),
            "workforce snapshot resolve",
            cancellationToken);
        return await ReadInternalEmployeesAsync(response, cancellationToken);
    }

    public async Task<CoreCampaignWorkforceContext> GetCampaignWorkforceContextAsync(
        DateTime asOf,
        IReadOnlyCollection<Guid> employeeIds,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/internal/corehr/campaign-workforce/context")
        {
            Content = JsonContent.Create(new
            {
                asOf,
                employeeIds = employeeIds.Count == 0 ? null : employeeIds
            })
        };

        await internalServiceRequestSigner.SignAsync(request, cancellationToken);
        using var response = await GuardAsync(
            () => httpClient.SendAsync(request, cancellationToken),
            "campaign workforce context",
            cancellationToken);
        EnsureAnswered(response, "campaign workforce");

        return await response.Content.ReadFromJsonAsync<CoreCampaignWorkforceContext>(cancellationToken)
            ?? new CoreCampaignWorkforceContext(asOf, string.Empty, []);
    }

    public async Task<CoreApplicabilityOptions> GetApplicabilityOptionsAsync(CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/internal/corehr/applicability-options");
        await internalServiceRequestSigner.SignAsync(request, cancellationToken);
        using var response = await GuardAsync(
            () => httpClient.SendAsync(request, cancellationToken),
            "applicability options",
            cancellationToken);

        EnsureAnswered(response, "applicability-options");

        return await response.Content.ReadFromJsonAsync<CoreApplicabilityOptions>(cancellationToken)
            ?? new CoreApplicabilityOptions([], [], [], []);
    }

    private sealed class PagedEmployeeResponse
    {
        public List<CoreEmployeeSummary> Items { get; set; } = [];
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    private static async Task<IReadOnlyList<CoreEmployeeSummary>> ReadEmployeesAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        EnsureAnswered(response, "workforce");

        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<List<CoreEmployeeSummary>>>(cancellationToken);
        return payload?.Data ?? [];
    }

    private static async Task<IReadOnlyList<CoreEmployeeSummary>> ReadInternalEmployeesAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        EnsureAnswered(response, "workforce");

        return await response.Content.ReadFromJsonAsync<List<CoreEmployeeSummary>>(cancellationToken)
            ?? [];
    }

    /// <summary>
    /// Throws on a non-success status, distinguishing a dependency failure (Core could not answer:
    /// 5xx, timeout, throttle) from Core answering that the request itself was bad. Only the former
    /// is recoverable by retrying later.
    /// </summary>
    private static void EnsureAnswered(HttpResponseMessage response, string operation)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var status = (int)response.StatusCode;
        if (status >= 500
            || response.StatusCode is System.Net.HttpStatusCode.RequestTimeout
                or System.Net.HttpStatusCode.TooManyRequests)
        {
            throw new CoreWorkforceUnavailableException(
                $"Core HR answered the {operation} request with status {status}.");
        }

        throw new InvalidOperationException(
            $"Core {operation} request failed with status {status}.");
    }

    /// <summary>
    /// Runs an outbound call, translating transport failures, resilience-pipeline timeouts, and an
    /// open circuit into <see cref="CoreWorkforceUnavailableException"/>. A cancellation the caller
    /// asked for is rethrown untouched — that is not a dependency failure.
    /// </summary>
    private static async Task<T> GuardAsync<T>(
        Func<Task<T>> send,
        string operation,
        CancellationToken cancellationToken)
    {
        try
        {
            return await send();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (exception
            is HttpRequestException
            or OperationCanceledException
            or Polly.Timeout.TimeoutRejectedException
            or Polly.CircuitBreaker.BrokenCircuitException)
        {
            throw new CoreWorkforceUnavailableException(
                $"Core HR could not be reached for the {operation} request.", exception);
        }
    }
}
