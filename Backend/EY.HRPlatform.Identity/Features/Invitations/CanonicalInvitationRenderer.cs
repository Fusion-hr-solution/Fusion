using System.Globalization;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.SharedKernel.Localization;
using EY.HRPlatform.SharedKernel.Notifications;

namespace EY.HRPlatform.Identity.Features.Invitations;

/// <summary>
/// Everything a canonical invitation may say. The caller supplies only controlled
/// facts — never arbitrary HTML or purpose copy. <see cref="AccessSummary"/> is a
/// single friendly baseline phrase (for example, "Employee access") and must never
/// carry permission keys, claims, or internal identifiers.
/// </summary>
public sealed record CanonicalInvitation(
    InvitationPurpose Purpose,
    string TenantName,
    string Email,
    string ActionUrl,
    DateTime ExpiresAtUtc,
    string? RecipientName = null,
    string? AccessSummary = null,
    string? InviterName = null);

public sealed record RenderedInvitation(string Subject, string Html, string Text);

/// <summary>
/// The one canonical Fusion invitation renderer (change task 3.5). It is pure: no
/// transport, no state, no audit, no I/O. Every purpose produces exact locked
/// subject/heading/CTA on the shared <see cref="FusionEmailLayout"/>, a UTC expiry stated
/// identically in HTML and text, an opaque fallback URL and a security note. The subject
/// is plain text.
/// </summary>
public static class CanonicalInvitationRenderer
{
    public static RenderedInvitation Render(CanonicalInvitation invitation)
    {
        ArgumentNullException.ThrowIfNull(invitation);

        var copy = ResolveCopy(invitation);
        var expiry = FormatExpiry(invitation.ExpiresAtUtc);

        var rendered = FusionEmailLayout.Render(new FusionEmailContent(
            FusionLanguages.English,
            copy.Subject,
            copy.Heading,
            [copy.Lead],
            copy.Cta,
            invitation.ActionUrl,
            ["If you were not expecting this, you can ignore this message."],
            Greeting: string.IsNullOrWhiteSpace(invitation.RecipientName) ? null : $"Hello {invitation.RecipientName!.Trim()},",
            Facts: [
                .. string.IsNullOrWhiteSpace(invitation.AccessSummary) ? [] : new[] { new FusionEmailFact("Access", invitation.AccessSummary!) },
                new FusionEmailFact("Invitation sent to", invitation.Email),
            ],
            ActionNote: $"This invitation expires on {expiry}.",
            FallbackLinkNote: "If the button does not work, copy this address into your browser:"));

        return new RenderedInvitation(rendered.Subject, rendered.Html, rendered.Text);
    }

    /// <summary>UTC named explicitly, in calendar terms, so the same instant reads the same in every client.</summary>
    public static string FormatExpiry(DateTime expiresAtUtc)
    {
        var value = expiresAtUtc.Kind == DateTimeKind.Utc
            ? expiresAtUtc
            : DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc);

        return value.ToString("d MMMM yyyy 'at' HH:mm 'UTC'", CultureInfo.InvariantCulture);
    }

    private sealed record PurposeCopy(string Subject, string Heading, string Cta, string Lead);

    private static PurposeCopy ResolveCopy(CanonicalInvitation invitation)
    {
        var tenant = invitation.TenantName;

        return invitation.Purpose switch
        {
            InvitationPurpose.OrganizationBootstrap => new PurposeCopy(
                Subject: $"Set up your Fusion administrator account for {tenant}",
                Heading: "Set up your administrator account",
                Cta: "Set up administrator account",
                Lead: $"You are setting up the first administrator account for {tenant}. "
                    + "It is the first account for this organization, so no one else can set it up for you."),

            InvitationPurpose.TenantAdministrator => new PurposeCopy(
                Subject: $"You're invited to administer {tenant} in Fusion",
                Heading: "Administrator invitation",
                Cta: "Accept administrator invitation",
                Lead: $"You have been invited to join {tenant} as a Fusion administrator."),

            InvitationPurpose.TenantAdministratorRecovery => new PurposeCopy(
                Subject: $"Restore administrator access to {tenant}",
                Heading: "Restore administrator access",
                Cta: "Restore access",
                Lead: $"A recovery invitation was issued to restore administrator access to {tenant}."),

            InvitationPurpose.WorkforceAccount => new PurposeCopy(
                Subject: $"Activate your Fusion access for {tenant}",
                Heading: "Activate your Fusion account",
                Cta: "Activate Fusion access",
                Lead: $"Your organization has activated Fusion access for you at {tenant}."),

            _ => throw new ArgumentOutOfRangeException(
                nameof(invitation), invitation.Purpose, "Unsupported invitation purpose."),
        };
    }
}
