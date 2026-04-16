using System.Net;
using System.Net.Mail;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class SmtpCandidateInvitationEmailSender(
    IOptions<CandidateInvitationEmailOptions> optionsAccessor,
    ILogger<SmtpCandidateInvitationEmailSender> logger) : ICandidateInvitationEmailSender
{
    public async Task SendInvitationAsync(CandidateInvitationDto invitation, CancellationToken cancellationToken)
    {
        var options = optionsAccessor.Value;
        if (!options.Enabled)
        {
            throw new ApiException(
                "Candidate invitation email delivery is disabled by configuration.",
                StatusCodes.Status503ServiceUnavailable);
        }

        if (string.IsNullOrWhiteSpace(options.SmtpHost))
        {
            throw new ApiException(
                "Candidate invitation email is enabled, but SmtpHost is not configured.",
                StatusCodes.Status500InternalServerError);
        }

        var message = new MailMessage
        {
            Subject = options.Subject,
            Body = options.UseHtmlBody ? BuildHtmlBody(invitation, options) : BuildTextBody(invitation),
            IsBodyHtml = options.UseHtmlBody,
            From = new MailAddress(options.FromEmail, options.FromName),
        };

        message.To.Add(invitation.Email);

        if (!string.IsNullOrWhiteSpace(options.ReplyToEmail))
        {
            message.ReplyToList.Add(new MailAddress(options.ReplyToEmail));
        }

        using (message)
        {
            using var smtpClient = new SmtpClient(options.SmtpHost, options.SmtpPort)
            {
                EnableSsl = options.UseSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
            };

            if (!string.IsNullOrWhiteSpace(options.Username))
            {
                smtpClient.Credentials = new NetworkCredential(options.Username, options.Password ?? string.Empty);
            }

            await smtpClient.SendMailAsync(message, cancellationToken);
        }

        logger.LogInformation(
            "Audit Event: CandidateInvitationEmailSent | InvitationId={InvitationId} | Email={Email}",
            invitation.Id,
            invitation.Email);
    }

    private static string BuildTextBody(CandidateInvitationDto invitation)
    {
        var candidate = ResolveCandidateDisplayName(invitation.CandidateName, invitation.Email);
        var deadline = TryFormatDeadline(invitation.DeadlineUtc) ?? "No deadline";
        var timeLimit = TryFormatTimeLimit(invitation.TimeLimitMinutes) ?? "Not specified";
        var customMessage = string.IsNullOrWhiteSpace(invitation.CustomMessage) ? null : invitation.CustomMessage.Trim();

        var body =
            $"Hello {candidate},{Environment.NewLine}{Environment.NewLine}" +
            $"You have been invited to take the test '{invitation.TestTitle}'.{Environment.NewLine}" +
            $"Time limit: {timeLimit}{Environment.NewLine}" +
            $"Deadline: {deadline}{Environment.NewLine}" +
            $"Invitation link: {invitation.InviteLink}{Environment.NewLine}{Environment.NewLine}" +
            "Regards," + Environment.NewLine +
            "EY HR Platform";

        if (customMessage is not null)
        {
            body +=
                $"{Environment.NewLine}{Environment.NewLine}" +
                "Message from recruiter:" + Environment.NewLine +
                customMessage;
        }

        return body;
    }

    private static string BuildHtmlBody(CandidateInvitationDto invitation, CandidateInvitationEmailOptions options)
    {
        var candidate = WebUtility.HtmlEncode(
            ResolveCandidateDisplayName(invitation.CandidateName, invitation.Email));
        var brandName = WebUtility.HtmlEncode(
            string.IsNullOrWhiteSpace(options.FromName) ? "EY HR Platform" : options.FromName.Trim());
        var testTitle = WebUtility.HtmlEncode(invitation.TestTitle);
        var deadline = WebUtility.HtmlEncode(TryFormatDeadline(invitation.DeadlineUtc) ?? "No deadline");
        var timeLimit = WebUtility.HtmlEncode(TryFormatTimeLimit(invitation.TimeLimitMinutes) ?? "Not specified");
        var inviteLink = WebUtility.HtmlEncode(invitation.InviteLink);
        var customMessage = string.IsNullOrWhiteSpace(invitation.CustomMessage)
            ? null
            : WebUtility.HtmlEncode(invitation.CustomMessage.Trim())
                .Replace("\r\n", "<br/>")
                .Replace("\n", "<br/>");

        var customMessageSection = customMessage is null
            ? string.Empty
            : $"""
                <tr>
                    <td class="mobile-padding" style="padding:0 32px 22px 32px;">
                        <div class="message-box" style="background:#F6F6FA; border:1px solid #C4C4CD; border-left:4px solid #FFE600; border-radius:12px; padding:16px 16px 14px 16px;">
                            <p class="message-label" style="margin:0 0 6px 0; font-size:12px; line-height:16px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#1A1A24;">Message from recruiter</p>
                            <p class="message-text" style="margin:0; color:#747480; font-size:14px; line-height:22px;">{customMessage}</p>
                        </div>
                    </td>
                </tr>
                """;

        return $$"""
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="x-apple-disable-message-reformatting" />
                <meta name="color-scheme" content="light dark" />
                <meta name="supported-color-schemes" content="light dark" />
                <title>{{WebUtility.HtmlEncode(options.Subject)}}</title>
                <style>
                    :root {
                        color-scheme: light dark;
                        supported-color-schemes: light dark;
                    }

                    @media only screen and (max-width: 600px) {
                        .email-container { width: 100% !important; }
                        .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
                        .header-padding { padding-top: 24px !important; padding-bottom: 20px !important; }
                        .cta-button { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
                        .detail-col { display: block !important; width: 100% !important; }
                        .detail-gap { display: none !important; }
                        .headline { font-size: 22px !important; line-height: 28px !important; }
                    }

                    @media (prefers-color-scheme: dark) {
                        .bg-body { background: #0e1116 !important; }
                        .card { background: #171b22 !important; box-shadow: none !important; }
                        .header { background: #0c0f14 !important; }
                        .header-overline { color: #a7b0bc !important; }
                        .headline { color: #f5f7fa !important; }
                        .header-copy { color: #c2c8d0 !important; }
                        .badge { border-color: #4b5563 !important; color: #d1d5db !important; }

                        .panel { background: #11151c !important; border-color: #3b4350 !important; }
                        .panel-label { color: #a7b0bc !important; }
                        .panel-value { color: #f5f7fa !important; }

                        .body-copy,
                        .body-copy a,
                        .message-text,
                        .footer-text { color: #c2c8d0 !important; }
                        .body-copy a { text-decoration-color: #c2c8d0 !important; }

                        .divider { border-top-color: #3b4350 !important; }
                        .message-box { background: #11151c !important; border-color: #3b4350 !important; }
                        .message-label { color: #f5f7fa !important; }
                    }
                </style>
            </head>
            <body style="margin:0; padding:0; background:#F6F6FA; font-family:Segoe UI, Arial, sans-serif; color:#1A1A24;">
                <div style="display:none; max-height:0; overflow:hidden; opacity:0;">Interview invitation for {{testTitle}}. Review details and start when ready.</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-body" style="background:#F6F6FA; padding:28px 12px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="620" cellpadding="0" cellspacing="0" class="email-container card" style="width:620px; max-width:620px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(2,12,27,0.12);">
                                <tr>
                                    <td class="mobile-padding header-padding header" style="padding:28px 32px 24px 32px; background:#1A1A24;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="vertical-align:middle;">
                                                    <div style="font-size:20px; line-height:24px; font-weight:700; color:#ffffff;">{{brandName}}</div>
                                                </td>
                                                <td align="right" style="vertical-align:middle;">
                                                    <span class="badge" style="display:inline-block; padding:6px 10px; border:1px solid #C4C4CD; border-radius:999px; color:#C4C4CD; font-size:11px; line-height:14px; font-weight:600; letter-spacing:0.02em;">INTERVIEW INVITATION</span>
                                                </td>
                                            </tr>
                                        </table>
                                        <p class="header-overline" style="margin:20px 0 8px 0; color:#C4C4CD; font-size:13px; line-height:20px;">Hello {{candidate}},</p>
                                        <h1 class="headline" style="margin:0; color:#ffffff; font-size:27px; line-height:34px; font-weight:700;">You're invited to {{testTitle}}</h1>
                                        <p class="header-copy" style="margin:12px 0 0 0; color:#C4C4CD; font-size:14px; line-height:22px;">Review the details below and start when you're ready.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="mobile-padding" style="padding:24px 32px 12px 32px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td class="detail-col" width="49%" valign="top">
                                                    <div class="panel" style="background:#F6F6FA; border:1px solid #C4C4CD; border-radius:12px; padding:14px 14px 12px 14px;">
                                                        <p class="panel-label" style="margin:0 0 4px 0; color:#747480; font-size:12px; line-height:16px; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Time limit</p>
                                                        <p class="panel-value" style="margin:0; color:#1A1A24; font-size:16px; line-height:22px; font-weight:700;">{{timeLimit}}</p>
                                                    </div>
                                                </td>
                                                <td class="detail-gap" width="2%">&nbsp;</td>
                                                <td class="detail-col" width="49%" valign="top">
                                                    <div class="panel" style="background:#F6F6FA; border:1px solid #C4C4CD; border-radius:12px; padding:14px 14px 12px 14px;">
                                                        <p class="panel-label" style="margin:0 0 4px 0; color:#747480; font-size:12px; line-height:16px; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Deadline</p>
                                                        <p class="panel-value" style="margin:0; color:#1A1A24; font-size:16px; line-height:22px; font-weight:700;">{{deadline}}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="mobile-padding" style="padding:10px 32px 24px 32px;">
                                        <a href="{{inviteLink}}" class="cta-button" style="display:inline-block; background:#FFE600; color:#1A1A24; text-decoration:none; font-size:15px; font-weight:700; line-height:18px; padding:14px 22px; border-radius:10px;">Start interview</a>
                                        <p class="body-copy" style="margin:10px 0 0 0; color:#1A1A24; font-size:12px; line-height:18px;">This secure link is unique to your invitation.</p>
                                    </td>
                                </tr>
                                {{customMessageSection}}
                                <tr>
                                    <td class="mobile-padding body-copy" style="padding:0 32px 24px 32px; color:#747480; font-size:12px; line-height:19px;">
                                        If the button does not work, copy and paste this link into your browser:<br/>
                                        <a href="{{inviteLink}}" style="color:#1A1A24; text-decoration:underline; word-break:break-all;">{{inviteLink}}</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="mobile-padding footer-text divider" style="padding:16px 32px 22px 32px; border-top:1px solid #C4C4CD; color:#747480; font-size:12px; line-height:18px;">
                                        Regards,<br/>{{brandName}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """;
    }

    private static string ResolveCandidateDisplayName(string? candidateName, string email)
    {
        if (!string.IsNullOrWhiteSpace(candidateName))
        {
            return candidateName.Trim();
        }

        var localPart = email.Split('@', 2)[0].Trim();
        if (string.IsNullOrWhiteSpace(localPart))
        {
            return "there";
        }

        var pieces = localPart
            .Split(new[] { '.', '_', '-' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(static piece =>
            {
                if (piece.Length == 0)
                {
                    return piece;
                }

                return char.ToUpperInvariant(piece[0]) + piece[1..].ToLowerInvariant();
            });

        var resolved = string.Join(" ", pieces).Trim();
        return string.IsNullOrWhiteSpace(resolved) ? "there" : resolved;
    }

    private static string? TryFormatTimeLimit(int? timeLimitMinutes)
    {
        if (!timeLimitMinutes.HasValue || timeLimitMinutes.Value <= 0)
        {
            return null;
        }

        return $"{timeLimitMinutes.Value} minute(s)";
    }

    private static string? TryFormatDeadline(string? deadlineUtc)
    {
        if (string.IsNullOrWhiteSpace(deadlineUtc))
        {
            return null;
        }

        return DateTime.TryParse(deadlineUtc, out var parsed)
            ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc).ToString("yyyy-MM-dd HH:mm 'UTC'")
            : deadlineUtc;
    }
}