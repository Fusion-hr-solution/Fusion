using System.Net.Http.Json;

namespace EY.HRPlatform.Identity.Infrastructure.Services;

/// <summary>
/// Calls the Training service's internal provision endpoint via HTTP.
/// The HTTP client is pre-configured with the base address and X-Service-Key header.
/// </summary>
public class HttpTrainingServiceClient : ITrainingServiceClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<HttpTrainingServiceClient> _logger;

    public HttpTrainingServiceClient(HttpClient httpClient, ILogger<HttpTrainingServiceClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task ProvisionEmployeeAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                "/api/training/internal/employees/provision",
                new { EmployeeId = userId },
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Training service returned {StatusCode} when provisioning employee profile for user {UserId}",
                    (int)response.StatusCode, userId);
            }
        }
        catch (Exception ex)
        {
            // Never propagate — employee profile creation must not block user creation.
            _logger.LogError(ex,
                "Failed to provision employee profile in Training service for user {UserId}", userId);
        }
    }
}
