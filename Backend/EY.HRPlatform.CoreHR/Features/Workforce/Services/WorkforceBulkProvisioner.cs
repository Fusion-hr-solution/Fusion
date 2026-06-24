using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public sealed record WorkforceBulkProvisionSubject(
    Guid EmployeeId,
    string Email,
    string? FirstName,
    string? LastName);

public sealed record WorkforceBulkProvisionResultItem(
    Guid EmployeeId,
    string Outcome,
    string Message);

public sealed record WorkforceBulkProvisionResponse(
    List<WorkforceBulkProvisionResultItem> Items);

public interface IWorkforceBulkProvisioner
{
    Task<WorkforceBulkProvisionResponse> BulkProvisionAsync(
        List<WorkforceBulkProvisionSubject> subjects,
        Guid accessProfileId,
        CancellationToken cancellationToken);
}

public sealed class WorkforceBulkProvisioner(
    HttpClient httpClient,
    IHttpContextAccessor httpContextAccessor) : IWorkforceBulkProvisioner
{
    public async Task<WorkforceBulkProvisionResponse> BulkProvisionAsync(
        List<WorkforceBulkProvisionSubject> subjects,
        Guid accessProfileId,
        CancellationToken cancellationToken)
    {
        if (subjects.Count == 0)
        {
            return new WorkforceBulkProvisionResponse([]);
        }

        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No active HTTP context is available for bulk provision.");

        if (!httpContext.Request.Headers.TryGetValue("Authorization", out var authorizationHeader))
            throw new InvalidOperationException("Authorization header is required for bulk provision.");

        var requestBody = new
        {
            Items = subjects.Select(s => new
            {
                s.EmployeeId,
                s.Email,
                s.FirstName,
                s.LastName,
                AccessProfileId = accessProfileId
            }).ToList()
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/corehr/employees/workforce-accounts/bulk-provision");
        request.Headers.TryAddWithoutValidation("Authorization", authorizationHeader.ToString());

        if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader))
            request.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantHeader.ToString());

        request.Content = JsonContent.Create(requestBody);

        using var response = await httpClient.SendAsync(request, cancellationToken);

        ApiResponse<List<WorkforceBulkProvisionResultItemInternal>>? envelope = null;
        try
        {
            envelope = await response.Content.ReadFromJsonAsync<ApiResponse<List<WorkforceBulkProvisionResultItemInternal>>>(
                cancellationToken: cancellationToken);
        }
        catch
        {
            envelope = null;
        }

        if (!response.IsSuccessStatusCode || envelope?.IsSuccess != true || envelope.Data is null)
        {
            var message = envelope?.Errors.FirstOrDefault() ?? "Bulk provision request failed.";
            throw new InvalidOperationException(message);
        }

        var items = envelope.Data
            .Select(i => new WorkforceBulkProvisionResultItem(i.EmployeeId, i.Outcome, i.Message))
            .ToList();

        return new WorkforceBulkProvisionResponse(items);
    }

    private sealed record WorkforceBulkProvisionResultItemInternal(
        Guid EmployeeId,
        string Outcome,
        string Message);
}
