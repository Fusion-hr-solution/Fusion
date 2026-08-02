namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Canonical invitation state. Recovery actions are bound to these states:
/// resend, revoke, and replace apply only to Pending; reissue applies only to
/// Expired or Revoked; Accepted and Superseded expose no recovery action.
/// </summary>
public enum InvitationState
{
    Pending = 0,
    Accepted = 1,
    Expired = 2,
    Revoked = 3,
    Superseded = 4,
}
