namespace EY.HRPlatform.Identity.Infrastructure.Services;

/// <summary>
/// Service-to-service client for the Training microservice.
/// Calls are fire-and-forget: failures are logged but never propagate to the caller.
/// </summary>
public interface ITrainingServiceClient
{
    /// <summary>
    /// Provisions (upserts) the EmployeeProfile in the Training service for the given user,
    /// syncing the display name and email. Should be called whenever a user is created or
    /// assigned the Employee role.
    /// </summary>
    Task ProvisionEmployeeAsync(Guid userId, string? fullName = null, string? email = null, CancellationToken cancellationToken = default);
}
