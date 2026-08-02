namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Outcome of one completed post-commit delivery request. There is deliberately
/// no Started or Unknown state: an attempt row is written only once the sender
/// has returned, so no lease, inference window, or reconciliation job is needed.
/// </summary>
public enum InvitationDeliveryOutcome
{
    Sent = 0,
    Failed = 1,
}
