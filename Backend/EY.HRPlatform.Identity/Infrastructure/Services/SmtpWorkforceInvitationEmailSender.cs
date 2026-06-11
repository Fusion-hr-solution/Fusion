using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Identity.Infrastructure.Services;

public sealed class SmtpWorkforceInvitationEmailSender(
    IOptions<WorkforceInvitationEmailOptions> optionsAccessor,
    ILogger<SmtpWorkforceInvitationEmailSender> logger) : IWorkforceInvitationEmailSender
{
    public async Task<WorkforceInvitationEmailDeliveryResult> SendInvitationAsync(
        WorkforceInvitationEmailMessage invitation,
        CancellationToken cancellationToken)
    {
        var options = optionsAccessor.Value;

        if (!options.Enabled)
        {
            return WorkforceInvitationEmailDeliveryResult.Suppressed(
                "Email disabled. Use the fallback invite link to continue.");
        }

        if (string.IsNullOrWhiteSpace(options.SmtpHost))
        {
            return WorkforceInvitationEmailDeliveryResult.Failed(
                "Invitation email is enabled, but SmtpHost is not configured.");
        }

        try
        {
            var message = new MailMessage
            {
                Subject = options.Subject,
                Body = options.UseHtmlBody
                    ? BuildHtmlBody(invitation, options)
                    : BuildTextBody(invitation, options),
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
                    smtpClient.Credentials = new NetworkCredential(
                        options.Username,
                        options.Password ?? string.Empty);
                }

                await smtpClient.SendMailAsync(message, cancellationToken);
            }

            logger.LogInformation(
                "Audit Event: WorkforceInvitationEmailSent | InviteId={InviteId} | Email={Email}",
                invitation.InviteId,
                invitation.Email);

            return WorkforceInvitationEmailDeliveryResult.Sent();
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to send workforce invitation email for InviteId={InviteId} Email={Email}.",
                invitation.InviteId,
                invitation.Email);

            return WorkforceInvitationEmailDeliveryResult.Failed(
                "Email failed. Use the fallback invite link to continue.");
        }
    }

    private static string BuildTextBody(
        WorkforceInvitationEmailMessage invitation,
        WorkforceInvitationEmailOptions options)
    {
        var recipientName = ResolveRecipientName(invitation);
        var roleLabel = ResolveRoleLabel(invitation.Role);

        return
            $"Hello {recipientName},{Environment.NewLine}{Environment.NewLine}" +
            $"You have been invited to join {invitation.TenantName} in Fusion as {roleLabel}.{Environment.NewLine}" +
            $"Invitation link: {invitation.InviteLink}{Environment.NewLine}{Environment.NewLine}" +
            $"Regards,{Environment.NewLine}{options.FromName}";
    }

    private static string BuildHtmlBody(
        WorkforceInvitationEmailMessage invitation,
        WorkforceInvitationEmailOptions options)
    {
        var recipientName = WebUtility.HtmlEncode(ResolveRecipientName(invitation));
        var tenantName = WebUtility.HtmlEncode(invitation.TenantName);
        var roleLabel = WebUtility.HtmlEncode(ResolveRoleLabel(invitation.Role));
        var inviteLink = WebUtility.HtmlEncode(invitation.InviteLink);
        var brandName = WebUtility.HtmlEncode(options.FromName);
        var subject = WebUtility.HtmlEncode(options.Subject);

        return $$"""
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{{subject}}</title>
            </head>
            <body style="margin:0; padding:24px; background:#f5f5f5; font-family:Segoe UI, Arial, sans-serif; color:#1a1a24;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(2,12,27,0.12);">
                                <tr>
                                    <td style="padding:28px 32px; background:#1a1a24; color:#ffffff;">
                                        <p style="margin:0 0 8px 0; font-size:13px; line-height:20px; color:#d0d0d6;">Hello {{recipientName}},</p>
                                        <h1 style="margin:0; font-size:28px; line-height:34px; font-weight:700;">Your Fusion workspace is ready</h1>
                                        <p style="margin:12px 0 0 0; font-size:14px; line-height:22px; color:#d0d0d6;">Join {{tenantName}} as {{roleLabel}} and sign in to the Core workspace.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:24px 32px;">
                                        <a href="{{inviteLink}}" style="display:inline-block; background:#ffe600; color:#1a1a24; text-decoration:none; font-size:15px; font-weight:700; line-height:18px; padding:14px 22px; border-radius:10px;">Accept invitation</a>
                                        <p style="margin:18px 0 0 0; color:#555566; font-size:13px; line-height:20px;">If the button does not work, copy and paste this link into your browser:</p>
                                        <p style="margin:8px 0 0 0;"><a href="{{inviteLink}}" style="color:#1a1a24; word-break:break-all;">{{inviteLink}}</a></p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:16px 32px 24px 32px; border-top:1px solid #e7e7ec; color:#555566; font-size:12px; line-height:18px;">
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

    private static string ResolveRecipientName(WorkforceInvitationEmailMessage invitation)
    {
        var fullName = string.Join(
            " ",
            new[] { invitation.RecipientFirstName, invitation.RecipientLastName }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim()));

        if (!string.IsNullOrWhiteSpace(fullName))
        {
            return fullName;
        }

        var localPart = invitation.Email.Split('@', 2)[0].Trim();
        return string.IsNullOrWhiteSpace(localPart) ? "there" : localPart;
    }

    private static string ResolveRoleLabel(string role)
        => role switch
        {
            "Manager" => "Manager",
            "Employee" => "Employee",
            "HRAdmin" => "HR administrator",
            _ => role,
        };
}
