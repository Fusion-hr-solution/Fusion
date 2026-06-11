namespace EY.HRPlatform.Identity.Infrastructure.Services;

public interface IWorkforceInvitationEmailSender
{
    Task<WorkforceInvitationEmailDeliveryResult> SendInvitationAsync(
        WorkforceInvitationEmailMessage invitation,
        CancellationToken cancellationToken);
}

public sealed record WorkforceInvitationEmailMessage(
    Guid InviteId,
    string Email,
    string InviteLink,
    string TenantName,
    string Role,
    string? RecipientFirstName,
    string? RecipientLastName);

public static class WorkforceInvitationEmailDeliveryStates
{
    public const string Sent = "Sent";
    public const string Suppressed = "Suppressed";
    public const string Failed = "Failed";
}

public sealed record WorkforceInvitationEmailDeliveryResult(string Status, string Message)
{
    public static WorkforceInvitationEmailDeliveryResult Sent(string message = "Invitation email sent.")
        => new(WorkforceInvitationEmailDeliveryStates.Sent, message);

    public static WorkforceInvitationEmailDeliveryResult Suppressed(string message)
        => new(WorkforceInvitationEmailDeliveryStates.Suppressed, message);

    public static WorkforceInvitationEmailDeliveryResult Failed(string message)
        => new(WorkforceInvitationEmailDeliveryStates.Failed, message);
}
