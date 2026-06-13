using System.Net.Http.Json;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.CoreHR.Features.Employees.Services;

public sealed record WorkforceAccountSubjectDto(
    Guid EmployeeId,
    string Email,
    string? FirstName,
    string? LastName);

public sealed record WorkforceAccountStatusesRequestDto(
    List<WorkforceAccountSubjectDto> Subjects);

public sealed record WorkforceAccountAccessProfileDto(
    Guid Id,
    string Name,
    string Type,
    bool IsSystemProtected);

public sealed record WorkforceAccountConflictDto(
    string Kind,
    string Message,
    bool Blocking,
    string? SuggestedAction);

public sealed record WorkforceAccountStatusDto(
    Guid EmployeeId,
    string Email,
    string? FullName,
    string Role,
    IReadOnlyList<WorkforceAccountAccessProfileDto> AccessProfiles,
    string ProvisioningState,
    Guid? UserId,
    bool? IsActive,
    DateTime? LastLoginAt,
    Guid? InviteId,
    DateTime? InviteCreatedAt,
    DateTime? InviteExpiresAt,
    string? InviteLink,
    string? DeliveryStatus,
    string? DeliveryMessage,
    DateTime? DeliveryRecordedAt,
    WorkforceAccountConflictDto? Conflict);

public interface IWorkforceAccountStatusReader
{
    Task<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>> GetStatusesAsync(
        IReadOnlyCollection<WorkforceAccountSubjectDto> subjects,
        CancellationToken cancellationToken);
}

public sealed class IdentityWorkforceAccountStatusReader(
    HttpClient httpClient,
    IHttpContextAccessor httpContextAccessor) : IWorkforceAccountStatusReader
{
    private const int BatchSize = 200;

    public async Task<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>> GetStatusesAsync(
        IReadOnlyCollection<WorkforceAccountSubjectDto> subjects,
        CancellationToken cancellationToken)
    {
        if (subjects.Count == 0)
        {
            return new Dictionary<Guid, WorkforceAccountStatusDto>();
        }

        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No active HTTP context is available for workforce account status resolution.");

        if (!httpContext.Request.Headers.TryGetValue("Authorization", out var authorizationHeader))
            throw new InvalidOperationException("Authorization header is required for workforce account status resolution.");

        var statuses = new Dictionary<Guid, WorkforceAccountStatusDto>();

        foreach (var chunk in subjects.Chunk(BatchSize))
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "api/corehr/employees/workforce-accounts/statuses");
            request.Headers.TryAddWithoutValidation("Authorization", authorizationHeader.ToString());

            if (httpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader))
                request.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantHeader.ToString());

            request.Content = JsonContent.Create(new WorkforceAccountStatusesRequestDto(chunk.ToList()));

            using var response = await httpClient.SendAsync(request, cancellationToken);

            ApiResponse<List<WorkforceAccountStatusDto>>? envelope = null;
            try
            {
                envelope = await response.Content.ReadFromJsonAsync<ApiResponse<List<WorkforceAccountStatusDto>>>(
                    cancellationToken: cancellationToken);
            }
            catch
            {
                envelope = null;
            }

            if (!response.IsSuccessStatusCode || envelope?.IsSuccess != true || envelope.Data is null)
            {
                var message = envelope?.Errors.FirstOrDefault() ?? "Unable to resolve workforce account status from Identity.";
                throw new InvalidOperationException(message);
            }

            foreach (var status in envelope.Data)
            {
                statuses[status.EmployeeId] = status;
            }
        }

        return statuses;
    }
}
