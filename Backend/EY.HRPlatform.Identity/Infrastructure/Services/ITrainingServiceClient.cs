namespace EY.HRPlatform.Identity.Infrastructure.Services;

/// <summary>
/// Service-to-service client for the Training microservice.
/// Calls are fire-and-forget: failures are logged but never propagate to the caller.
/// </summary>
public interface ITrainingServiceClient
{
    /// <summary>
    /// Provisions an empty EmployeeProfile in the Training service for the given user.
    /// Should be called whenever a user is assigned the Employee role.
    /// </summary>
    Task ProvisionEmployeeAsync(Guid userId, CancellationToken cancellationToken = default);
}
