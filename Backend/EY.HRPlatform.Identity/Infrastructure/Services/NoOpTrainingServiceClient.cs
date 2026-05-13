namespace EY.HRPlatform.Identity.Infrastructure.Services;

/// <summary>
/// Local-development fallback when the optional Training integration is not configured.
/// Invite and user flows should still succeed; downstream provisioning is skipped.
/// </summary>
public sealed class NoOpTrainingServiceClient(
    ILogger<NoOpTrainingServiceClient> logger) : ITrainingServiceClient
{
    public Task ProvisionEmployeeAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        logger.LogWarning(
            "Skipping Training employee provisioning for user {UserId} because the Training integration is not configured.",
            userId);
        return Task.CompletedTask;
    }
}