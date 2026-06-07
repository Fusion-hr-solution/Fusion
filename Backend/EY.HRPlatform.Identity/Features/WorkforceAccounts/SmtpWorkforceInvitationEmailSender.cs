using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Identity.Features.WorkforceAccounts;

public sealed class SmtpWorkforceInvitationEmailSender(
    IOptions<WorkforceInvitationEmailOptions> optionsAccessor,
    ILogger<SmtpWorkforceInvitationEmailSender> logger) : IWorkforceInvitationEmailSender
{
    public async Task<WorkforceInvitationDeliveryResult> SendInviteAsync(
        WorkforceInvitationEmailMessage invitation,
        CancellationToken cancellationToken)
    {
        var options = optionsAccessor.Value;

        if (!options.Enabled)
        {
            return WorkforceInvitationDeliveryResult.Suppressed(
                "Email disabled. Manual link available.");
        }

        if (string.IsNullOrWhiteSpace(options.SmtpHost))
        {
            return WorkforceInvitationDeliveryResult.Suppressed(
                "Email delivery is not configured. Manual link available.");
        }

        var subject = BuildSubject(options, invitation);
        using var message = new MailMessage
        {
            Subject = subject,
            Body = options.UseHtmlBody
                ? BuildHtmlBody(invitation, options)
                : BuildTextBody(invitation),
            IsBodyHtml = options.UseHtmlBody,
            From = new MailAddress(options.FromEmail, options.FromName),
        };

        message.To.Add(invitation.Email);

        if (!string.IsNullOrWhiteSpace(options.ReplyToEmail))
        {
            message.ReplyToList.Add(new MailAddress(options.ReplyToEmail));
        }

        try
        {
            using var smtpClient = new SmtpClient(options.SmtpHost, options.SmtpPort)
            {
                EnableSsl = options.UseSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
            };

            if (!string.IsNullOrWhiteSpace(options.Username))
            {
                smtpClient.Credentials = new NetworkCredential(
                    options.Username,
                    options.Password ?? string.Empty);
            }

            await smtpClient.SendMailAsync(message, cancellationToken);

            logger.LogInformation(
                "Audit Event: WorkforceInvitationEmailSent | InviteId={InviteId} | TenantId={TenantId} | EmployeeId={EmployeeId} | Email={Email}",
                invitation.InviteId,
                invitation.TenantId,
                invitation.EmployeeId,
                invitation.Email);

            return WorkforceInvitationDeliveryResult.Sent("Email sent.");
        }
        catch (SmtpException ex)
        {
            logger.LogWarning(
                ex,
                "Workforce invitation email failed for InviteId={InviteId} to {Email}.",
                invitation.InviteId,
                invitation.Email);

            return WorkforceInvitationDeliveryResult.Failed(
                "Email failed. Manual link available.");
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Unexpected workforce invitation email failure for InviteId={InviteId} to {Email}.",
                invitation.InviteId,
                invitation.Email);

            return WorkforceInvitationDeliveryResult.Failed(
                "Email failed. Manual link available.");
        }
    }

    private static string BuildSubject(
        WorkforceInvitationEmailOptions options,
        WorkforceInvitationEmailMessage invitation)
    {
        var baseSubject = string.IsNullOrWhiteSpace(options.Subject)
            ? "Activate your EY HR Platform access"
            : options.Subject.Trim();

        return string.IsNullOrWhiteSpace(invitation.TenantName)
            ? baseSubject
            : $"{baseSubject} for {invitation.TenantName}";
    }

    private static string BuildTextBody(WorkforceInvitationEmailMessage invitation)
    {
        var recipient = ResolveRecipient(invitation);
        var profileSummary = invitation.AccessProfileNames.Count == 0
            ? "No access profile selected yet"
            : string.Join(", ", invitation.AccessProfileNames);

        return
            $"Hello {recipient},{Environment.NewLine}{Environment.NewLine}" +
            $"You have been invited to activate your access for {invitation.TenantName}.{Environment.NewLine}" +
            $"Assigned access profile: {profileSummary}{Environment.NewLine}" +
            $"Invitation link: {invitation.InviteLink}{Environment.NewLine}" +
            $"This link expires on {invitation.ExpiresAt:yyyy-MM-dd HH:mm 'UTC'}.{Environment.NewLine}{Environment.NewLine}" +
            "If email delivery is unavailable, you can still use this secure link to complete activation." +
            $"{Environment.NewLine}{Environment.NewLine}Regards,{Environment.NewLine}EY HR Platform";
    }

    private static string BuildHtmlBody(
        WorkforceInvitationEmailMessage invitation,
        WorkforceInvitationEmailOptions options)
    {
        var recipient = WebUtility.HtmlEncode(ResolveRecipient(invitation));
        var tenantName = WebUtility.HtmlEncode(invitation.TenantName);
        var inviteLink = WebUtility.HtmlEncode(invitation.InviteLink);
        var brandName = WebUtility.HtmlEncode(
            string.IsNullOrWhiteSpace(options.FromName)
                ? "EY HR Platform"
                : options.FromName.Trim());
        var accessProfiles = invitation.AccessProfileNames.Count == 0
            ? "<span style=\"color:#747480;\">No access profile selected yet</span>"
            : string.Join(", ", invitation.AccessProfileNames.Select(WebUtility.HtmlEncode));

        return $$"""
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{{WebUtility.HtmlEncode(BuildSubject(options, invitation))}}</title>
            </head>
            <body style="margin:0; padding:24px; background:#f6f6fa; font-family:Segoe UI, Arial, sans-serif; color:#1a1a24;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px; max-width:620px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 12px 30px rgba(2,12,27,0.12);">
                                <tr>
                                    <td style="padding:28px 32px 22px 32px; background:#1a1a24; color:#ffffff;">
                                        <div style="font-size:20px; font-weight:700;">{{brandName}}</div>
                                        <p style="margin:18px 0 8px 0; color:#c4c4cd; font-size:13px;">Hello {{recipient}},</p>
                                        <h1 style="margin:0; font-size:27px; line-height:34px; font-weight:700;">Activate your access</h1>
                                        <p style="margin:12px 0 0 0; color:#c4c4cd; font-size:14px; line-height:22px;">Your organization is ready to give you access to {{tenantName}}.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:24px 32px 0 32px;">
                                        <div style="background:#f6f6fa; border:1px solid #c4c4cd; border-radius:12px; padding:16px;">
                                            <p style="margin:0 0 6px 0; color:#747480; font-size:12px; text-transform:uppercase; letter-spacing:0.03em;">Assigned access profile</p>
                                            <p style="margin:0; color:#1a1a24; font-size:16px; line-height:24px; font-weight:700;">{{accessProfiles}}</p>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:20px 32px 0 32px;">
                                        <a href="{{inviteLink}}" style="display:inline-block; background:#ffe600; color:#1a1a24; text-decoration:none; font-size:15px; font-weight:700; line-height:18px; padding:14px 22px; border-radius:10px;">Activate access</a>
                                        <p style="margin:10px 0 0 0; color:#747480; font-size:12px; line-height:18px;">This secure link expires on {{invitation.ExpiresAt:yyyy-MM-dd HH:mm 'UTC'}}.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:20px 32px 24px 32px; color:#747480; font-size:12px; line-height:19px;">
                                        If the button does not work, copy and paste this link into your browser:<br />
                                        <a href="{{inviteLink}}" style="color:#1a1a24; word-break:break-all;">{{inviteLink}}</a>
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

    private static string ResolveRecipient(WorkforceInvitationEmailMessage invitation)
    {
        if (!string.IsNullOrWhiteSpace(invitation.RecipientName))
        {
            return invitation.RecipientName.Trim();
        }

        var localPart = invitation.Email.Split('@', 2)[0].Trim();
        return string.IsNullOrWhiteSpace(localPart) ? "there" : localPart;
    }
}
