namespace EY.HRPlatform.Identity.Infrastructure.Services;

public sealed class NoOpWorkforceInvitationEmailSender(
    ILogger<NoOpWorkforceInvitationEmailSender> logger) : IWorkforceInvitationEmailSender
{
    public Task<WorkforceInvitationEmailDeliveryResult> SendInvitationAsync(
        WorkforceInvitationEmailMessage invitation,
        CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Skipping workforce invitation email delivery for InviteId={InviteId} Email={Email} because delivery is disabled.",
            invitation.InviteId,
            invitation.Email);

        return Task.FromResult(WorkforceInvitationEmailDeliveryResult.Suppressed(
            "Email disabled. Use the fallback invite link to continue."));
    }
}
