using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// One completed post-commit delivery request for an invitation. A failed attempt
/// leaves the invitation Pending and recoverable rather than rolling back
/// committed provisioning.
/// </summary>
public class InvitationDeliveryAttempt
{
    private InvitationDeliveryAttempt() { } // EF constructor

    public Guid Id { get; private set; }

    public Guid InvitationId { get; private set; }

    public DateTime AttemptedAt { get; private set; }

    public InvitationDeliveryOutcome Outcome { get; private set; }

    /// <summary>
    /// Bounded failure code. Raw provider errors are never stored.
    /// </summary>
    public string? SanitizedFailureCode { get; private set; }

    /// <summary>
    /// Platform Administrator who caused the delivery. Every specified delivery
    /// path — initial send after provisioning, resend, replace, reissue — has one,
    /// and the design admits no background retry, so this is never absent.
    /// </summary>
    public Guid InitiatedByAccountId { get; private set; }

    public InviteToken? Invitation { get; private set; }

    public static InvitationDeliveryAttempt Sent(
        Guid invitationId,
        Guid initiatedByAccountId,
        DateTime? attemptedAt = null)
    {
        ValidateInvitationId(invitationId);
        ValidateInitiatedBy(initiatedByAccountId);

        return new InvitationDeliveryAttempt
        {
            Id = Guid.NewGuid(),
            InvitationId = invitationId,
            AttemptedAt = attemptedAt ?? DateTime.UtcNow,
            Outcome = InvitationDeliveryOutcome.Sent,
            SanitizedFailureCode = null,
            InitiatedByAccountId = initiatedByAccountId,
        };
    }

    public static InvitationDeliveryAttempt Failed(
        Guid invitationId,
        string sanitizedFailureCode,
        Guid initiatedByAccountId,
        DateTime? attemptedAt = null)
    {
        ValidateInvitationId(invitationId);
        ValidateInitiatedBy(initiatedByAccountId);

        if (string.IsNullOrWhiteSpace(sanitizedFailureCode))
            throw new ArgumentException("Sanitized failure code is required.", nameof(sanitizedFailureCode));

        return new InvitationDeliveryAttempt
        {
            Id = Guid.NewGuid(),
            InvitationId = invitationId,
            AttemptedAt = attemptedAt ?? DateTime.UtcNow,
            Outcome = InvitationDeliveryOutcome.Failed,
            SanitizedFailureCode = sanitizedFailureCode.Trim(),
            InitiatedByAccountId = initiatedByAccountId,
        };
    }

    private static void ValidateInvitationId(Guid invitationId)
    {
        if (invitationId == Guid.Empty)
            throw new ArgumentException("Invitation ID is required.", nameof(invitationId));
    }

    private static void ValidateInitiatedBy(Guid initiatedByAccountId)
    {
        if (initiatedByAccountId == Guid.Empty)
            throw new ArgumentException("Initiating account ID is required.", nameof(initiatedByAccountId));
    }
}
