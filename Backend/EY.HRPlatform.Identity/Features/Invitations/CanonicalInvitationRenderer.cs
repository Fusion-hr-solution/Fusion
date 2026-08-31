using System.Globalization;
using System.Net;
using EY.HRPlatform.Identity.Domain.Enums;

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
/// subject/heading/CTA, an email-safe one-column inline-CSS table with visible text
/// branding and a single primary action, a UTC expiry stated identically in HTML and
/// text, an opaque fallback URL, a security note, and a text equivalent. Every dynamic
/// value is HTML-escaped in the HTML view; the subject is plain text. The message
/// depends on no remote image or external stylesheet and carries no gradients, glass,
/// illustration, or marketing.
/// </summary>
public static class CanonicalInvitationRenderer
{
    public static RenderedInvitation Render(CanonicalInvitation invitation)
    {
        ArgumentNullException.ThrowIfNull(invitation);

        var copy = ResolveCopy(invitation);
        var expiry = FormatExpiry(invitation.ExpiresAtUtc);

        return new RenderedInvitation(
            copy.Subject,
            BuildHtml(invitation, copy, expiry),
            BuildText(invitation, copy, expiry));
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

    private static string BuildText(CanonicalInvitation invitation, PurposeCopy copy, string expiry)
    {
        var lines = new List<string> { "Fusion", "" };

        if (!string.IsNullOrWhiteSpace(invitation.RecipientName))
        {
            lines.Add($"Hello {invitation.RecipientName!.Trim()},");
            lines.Add("");
        }

        lines.Add(copy.Lead);
        lines.Add("");

        if (!string.IsNullOrWhiteSpace(invitation.AccessSummary))
        {
            lines.Add($"Access: {invitation.AccessSummary!.Trim()}");
            lines.Add("");
        }

        lines.Add($"This invitation was sent to {invitation.Email}.");
        lines.Add("");
        lines.Add($"{copy.Cta}:");
        lines.Add(invitation.ActionUrl);
        lines.Add("");
        lines.Add($"This invitation expires on {expiry}.");
        lines.Add("");
        lines.Add("If you were not expecting this, you can ignore this message.");

        return string.Join(Environment.NewLine, lines);
    }

    private static string BuildHtml(CanonicalInvitation invitation, PurposeCopy copy, string expiry)
    {
        var heading = WebUtility.HtmlEncode(copy.Heading);
        var lead = WebUtility.HtmlEncode(copy.Lead);
        var cta = WebUtility.HtmlEncode(copy.Cta);
        var email = WebUtility.HtmlEncode(invitation.Email);
        var link = WebUtility.HtmlEncode(invitation.ActionUrl);
        var encodedSubject = WebUtility.HtmlEncode(copy.Subject);
        var encodedExpiry = WebUtility.HtmlEncode(expiry);

        var greeting = string.IsNullOrWhiteSpace(invitation.RecipientName)
            ? string.Empty
            : $"""
            <tr><td style="padding:22px 32px 0 32px;">
            <p style="margin:0; font-size:14px; line-height:22px; color:#6b6b76;">Hello {WebUtility.HtmlEncode(invitation.RecipientName!.Trim())},</p>
            </td></tr>
            """;

        var accessSummary = string.IsNullOrWhiteSpace(invitation.AccessSummary)
            ? string.Empty
            : $"""
            <tr><td style="padding:20px 32px 0 32px;">
            <div style="border:1px solid #e2e2e8; border-radius:10px; padding:14px 16px; background:#fafafb;">
            <div style="font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b76;">Access</div>
            <div style="margin-top:4px; font-size:15px; font-weight:600; color:#16161d;">{WebUtility.HtmlEncode(invitation.AccessSummary!.Trim())}</div>
            </div>
            </td></tr>
            """;

        return $"""
            <!doctype html>
            <html lang="en">
            <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{encodedSubject}</title>
            </head>
            <body style="margin:0; padding:32px 16px; background:#f4f4f6; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#16161d;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%; max-width:560px; background:#ffffff; border:1px solid #e2e2e8; border-radius:14px;">
            <tr><td style="padding:28px 32px 0 32px;">
            <div style="font-size:15px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#16161d;">Fusion</div>
            </td></tr>
            {greeting}
            <tr><td style="padding:22px 32px 0 32px;">
            <h1 style="margin:0; font-size:24px; line-height:32px; font-weight:700; color:#16161d;">{heading}</h1>
            <p style="margin:14px 0 0 0; font-size:15px; line-height:24px; color:#4a4a55;">{lead}</p>
            </td></tr>
            {accessSummary}
            <tr><td style="padding:20px 32px 0 32px;">
            <div style="border:1px solid #e2e2e8; border-radius:10px; padding:14px 16px; background:#fafafb;">
            <div style="font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b76;">Invitation sent to</div>
            <div style="margin-top:4px; font-size:15px; font-weight:600; color:#16161d; word-break:break-all;">{email}</div>
            </div>
            </td></tr>
            <tr><td style="padding:24px 32px 0 32px;">
            <a href="{link}" style="display:inline-block; background:#f4c414; color:#2a1b00; text-decoration:none; font-size:15px; font-weight:600; line-height:20px; padding:14px 24px; border-radius:10px;">{cta}</a>
            <p style="margin:14px 0 0 0; font-size:13px; line-height:20px; color:#6b6b76;">This invitation expires on {encodedExpiry}.</p>
            </td></tr>
            <tr><td style="padding:22px 32px 28px 32px; border-top:1px solid #ececf1;">
            <p style="margin:18px 0 0 0; font-size:12px; line-height:19px; color:#6b6b76;">If the button does not work, copy this address into your browser:<br />
            <span style="color:#16161d; word-break:break-all;">{link}</span></p>
            <p style="margin:12px 0 0 0; font-size:12px; line-height:19px; color:#6b6b76;">If you were not expecting this, you can ignore this message.</p>
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            """;
    }
}
