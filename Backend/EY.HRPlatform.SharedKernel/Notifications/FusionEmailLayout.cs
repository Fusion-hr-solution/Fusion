using System.Net;
using EY.HRPlatform.SharedKernel.Localization;

namespace EY.HRPlatform.SharedKernel.Notifications;

/// <summary>A labelled fact shown in its own box ("Access: Manager access").</summary>
public sealed record FusionEmailFact(string Label, string Value);

/// <summary>
/// Everything a Fusion email may say. Callers pass controlled text only; every value is HTML-escaped. The footer
/// lines say why the email was sent and what to do about it.
/// </summary>
public sealed record FusionEmailContent(
    string Language,
    string Subject,
    string Heading,
    IReadOnlyList<string> Lead,
    string ActionLabel,
    string ActionUrl,
    IReadOnlyList<string> Footer,
    string? Greeting = null,
    IReadOnlyList<FusionEmailFact>? Facts = null,
    string? ActionNote = null,
    string? FallbackLinkNote = null,
    FusionEmailLink? FooterLink = null);

/// <summary>A link in the footer, such as the notification settings.</summary>
public sealed record FusionEmailLink(string Label, string Url);

public sealed record RenderedEmail(string Subject, string Html, string Text);

/// <summary>
/// The one Fusion email layout, shared by invitations and notifications: an email-safe one-column inline-CSS table with
/// text branding, a single primary action, a fallback address, a plain-text twin, and <c>lang</c>/<c>dir</c> from the
/// language. No remote image, external stylesheet or gradient.
/// </summary>
public static class FusionEmailLayout
{
    public static RenderedEmail Render(FusionEmailContent content)
    {
        ArgumentNullException.ThrowIfNull(content);
        return new RenderedEmail(content.Subject, BuildHtml(content), BuildText(content));
    }

    private static string BuildText(FusionEmailContent content)
    {
        var lines = new List<string> { "Fusion", "" };
        if (!string.IsNullOrWhiteSpace(content.Greeting)) lines.AddRange([content.Greeting!.Trim(), ""]);
        foreach (var paragraph in content.Lead) lines.AddRange([paragraph, ""]);
        foreach (var fact in content.Facts ?? []) lines.AddRange([$"{fact.Label}: {fact.Value.Trim()}", ""]);
        lines.Add($"{content.ActionLabel}:");
        lines.Add(content.ActionUrl);
        if (!string.IsNullOrWhiteSpace(content.ActionNote)) lines.AddRange(["", content.ActionNote!]);
        foreach (var line in content.Footer) lines.AddRange(["", line]);
        if (content.FooterLink is { } link) lines.AddRange(["", $"{link.Label}: {link.Url}"]);
        return string.Join(Environment.NewLine, lines);
    }

    private static string BuildHtml(FusionEmailContent content)
    {
        static string E(string value) => WebUtility.HtmlEncode(value);
        var language = FusionLanguages.IsSupported(content.Language) ? content.Language : FusionLanguages.Default;
        var direction = language == FusionLanguages.Arabic ? "rtl" : "ltr";
        var link = E(content.ActionUrl);

        var greeting = string.IsNullOrWhiteSpace(content.Greeting) ? string.Empty : $"""
            <tr><td style="padding:22px 32px 0 32px;">
            <p style="margin:0; font-size:14px; line-height:22px; color:#6b6b76;">{E(content.Greeting!.Trim())}</p>
            </td></tr>
            """;
        var lead = string.Concat(content.Lead.Select(paragraph =>
            $"""<p style="margin:14px 0 0 0; font-size:15px; line-height:24px; color:#4a4a55;">{E(paragraph)}</p>"""));
        var facts = string.Concat((content.Facts ?? []).Select(fact => $"""
            <tr><td style="padding:20px 32px 0 32px;">
            <div style="border:1px solid #e2e2e8; border-radius:10px; padding:14px 16px; background:#fafafb;">
            <div style="font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b76;">{E(fact.Label)}</div>
            <div style="margin-top:4px; font-size:15px; font-weight:600; color:#16161d; word-break:break-all;">{E(fact.Value.Trim())}</div>
            </div>
            </td></tr>
            """));
        var actionNote = string.IsNullOrWhiteSpace(content.ActionNote) ? string.Empty
            : $"""<p style="margin:14px 0 0 0; font-size:13px; line-height:20px; color:#6b6b76;">{E(content.ActionNote!)}</p>""";
        var fallback = string.IsNullOrWhiteSpace(content.FallbackLinkNote) ? string.Empty
            : $"""<p style="margin:18px 0 0 0; font-size:12px; line-height:19px; color:#6b6b76;">{E(content.FallbackLinkNote!)}<br /><span style="color:#16161d; word-break:break-all;">{link}</span></p>""";
        var footer = string.Concat(content.Footer.Select(line =>
            $"""<p style="margin:12px 0 0 0; font-size:12px; line-height:19px; color:#6b6b76;">{E(line)}</p>"""));
        var footerLink = content.FooterLink is { } settings
            ? $"""<p style="margin:12px 0 0 0; font-size:12px; line-height:19px;"><a href="{E(settings.Url)}" style="color:#16161d;">{E(settings.Label)}</a></p>"""
            : string.Empty;

        return $"""
            <!doctype html>
            <html lang="{language}" dir="{direction}">
            <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{E(content.Subject)}</title>
            </head>
            <body style="margin:0; padding:32px 16px; background:#f4f4f6; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#16161d;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="{direction}">
            <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%; max-width:560px; background:#ffffff; border:1px solid #e2e2e8; border-radius:14px; text-align:start;">
            <tr><td style="padding:28px 32px 0 32px;">
            <div style="font-size:15px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#16161d;">Fusion</div>
            </td></tr>
            {greeting}
            <tr><td style="padding:22px 32px 0 32px;">
            <h1 style="margin:0; font-size:24px; line-height:32px; font-weight:700; color:#16161d;">{E(content.Heading)}</h1>
            {lead}
            </td></tr>
            {facts}
            <tr><td style="padding:24px 32px 0 32px;">
            <a href="{link}" style="display:inline-block; background:#f4c414; color:#2a1b00; text-decoration:none; font-size:15px; font-weight:600; line-height:20px; padding:14px 24px; border-radius:10px;">{E(content.ActionLabel)}</a>
            {actionNote}
            </td></tr>
            <tr><td style="padding:22px 32px 28px 32px; border-top:1px solid #ececf1;">
            {fallback}
            {footer}
            {footerLink}
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            """;
    }
}
