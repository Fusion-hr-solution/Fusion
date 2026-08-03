using System.Globalization;
using System.Net;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

/// <summary>
/// Everything a bootstrap invitation message needs to say. Assembled once by the
/// delivery step so every sender — SMTP, local capture, or a future provider —
/// renders identical content from identical input.
/// </summary>
public sealed record BootstrapInvitationMessage(
    string TenantName,
    string Email,
    string ActivationLink,
    DateTime ExpiresAtUtc);

public sealed record RenderedBootstrapInvitation(string Subject, string Html, string Text);

/// <summary>
/// The one approved Fusion invitation message.
///
/// It carries the tenant, the invited address, why the recipient received it, when
/// the invitation stops working, and exactly one action. It deliberately carries
/// no password, no credential the recipient could read, no invitation identifier,
/// no marketing, and no product tour: this message exists to get one person to one
/// form, and anything else in it is either noise or a disclosure.
///
/// `Fusion` is the visible text identity. There is no logo asset, so the message
/// renders identically in clients that block remote images.
/// </summary>
public static class BootstrapInvitationTemplate
{
    public static RenderedBootstrapInvitation Render(BootstrapInvitationMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);

        var expiry = FormatExpiry(message.ExpiresAtUtc);
        var subject = $"Create your administrator account for {message.TenantName}";

        return new RenderedBootstrapInvitation(subject, BuildHtml(message, subject, expiry), BuildText(message, expiry));
    }

    /// <summary>
    /// The expiry as the recipient reads it, in their calendar's terms rather than
    /// a machine timestamp. UTC is named explicitly because the message crosses
    /// time zones and a bare time would be a guess.
    /// </summary>
    public static string FormatExpiry(DateTime expiresAtUtc)
    {
        var value = expiresAtUtc.Kind == DateTimeKind.Utc
            ? expiresAtUtc
            : DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc);

        return value.ToString("d MMMM yyyy 'at' HH:mm 'UTC'", CultureInfo.InvariantCulture);
    }

    private static string BuildText(BootstrapInvitationMessage message, string expiry) =>
        string.Join(Environment.NewLine,
        [
            "Fusion",
            "",
            $"You are creating the first administrator account for {message.TenantName}.",
            "",
            $"This invitation was sent to {message.Email}.",
            "",
            "Create administrator account:",
            message.ActivationLink,
            "",
            $"This invitation expires on {expiry}.",
            "",
            "If you were not expecting this, you can ignore this message.",
        ]);

    private static string BuildHtml(BootstrapInvitationMessage message, string subject, string expiry)
    {
        var tenantName = WebUtility.HtmlEncode(message.TenantName);
        var email = WebUtility.HtmlEncode(message.Email);
        var link = WebUtility.HtmlEncode(message.ActivationLink);
        var encodedSubject = WebUtility.HtmlEncode(subject);
        var encodedExpiry = WebUtility.HtmlEncode(expiry);

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
            <tr><td style="padding:22px 32px 0 32px;">
            <h1 style="margin:0; font-size:24px; line-height:32px; font-weight:700; color:#16161d;">Create the first administrator account for {tenantName}</h1>
            <p style="margin:14px 0 0 0; font-size:15px; line-height:24px; color:#4a4a55;">This account will administer {tenantName} in Fusion. It is the first account for this organization, so no one else can set it up for you.</p>
            </td></tr>
            <tr><td style="padding:24px 32px 0 32px;">
            <div style="border:1px solid #e2e2e8; border-radius:10px; padding:14px 16px; background:#fafafb;">
            <div style="font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b76;">Invitation sent to</div>
            <div style="margin-top:4px; font-size:15px; font-weight:600; color:#16161d; word-break:break-all;">{email}</div>
            </div>
            </td></tr>
            <tr><td style="padding:24px 32px 0 32px;">
            <a href="{link}" style="display:inline-block; background:#16161d; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; line-height:20px; padding:14px 24px; border-radius:10px;">Create administrator account</a>
            <p style="margin:14px 0 0 0; font-size:13px; line-height:20px; color:#6b6b76;">This invitation expires on {encodedExpiry}.</p>
            </td></tr>
            <tr><td style="padding:22px 32px 28px 32px; border-top:1px solid #ececf1; margin-top:24px;">
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
