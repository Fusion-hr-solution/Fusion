using System.Globalization;
using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Training.Infrastructure.Services;

/// <summary>
/// Self-contained SMTP sender for budget threshold alerts. Independent of the Identity / Interview
/// email infrastructure (shares no code). Best-effort: never throws — failures return a Failed result.
/// </summary>
public sealed class SmtpBudgetAlertEmailSender(
    IOptions<BudgetAlertEmailOptions> optionsAccessor,
    ILogger<SmtpBudgetAlertEmailSender> logger) : IBudgetAlertEmailSender
{
    public async Task<BudgetAlertEmailDeliveryResult> SendBudgetAlertAsync(
        BudgetAlertEmailMessage message,
        CancellationToken cancellationToken)
    {
        var options = optionsAccessor.Value;

        if (!options.Enabled)
            return BudgetAlertEmailDeliveryResult.Suppressed("Budget alert email disabled.");

        if (string.IsNullOrWhiteSpace(options.SmtpHost))
            return BudgetAlertEmailDeliveryResult.Failed(
                "Budget alert email is enabled, but SmtpHost is not configured.");

        if (string.IsNullOrWhiteSpace(options.AdminRecipientEmail))
            return BudgetAlertEmailDeliveryResult.Failed(
                "Budget alert email is enabled, but AdminRecipientEmail is not configured.");

        try
        {
            var mail = new MailMessage
            {
                Subject = $"{options.Subject} — {message.ServiceLineName} at {message.ThresholdPercent}%",
                Body = options.UseHtmlBody ? BuildHtmlBody(message, options) : BuildTextBody(message, options),
                IsBodyHtml = options.UseHtmlBody,
                From = new MailAddress(options.FromEmail, options.FromName),
            };

            mail.To.Add(options.AdminRecipientEmail);

            if (!string.IsNullOrWhiteSpace(options.ReplyToEmail))
                mail.ReplyToList.Add(new MailAddress(options.ReplyToEmail));

            using (mail)
            {
                using var smtpClient = new SmtpClient(options.SmtpHost, options.SmtpPort)
                {
                    EnableSsl = options.UseSsl,
                    DeliveryMethod = SmtpDeliveryMethod.Network,
                    UseDefaultCredentials = false,
                };

                if (!string.IsNullOrWhiteSpace(options.Username))
                    smtpClient.Credentials = new NetworkCredential(options.Username, options.Password ?? string.Empty);

                await smtpClient.SendMailAsync(mail, cancellationToken);
            }

            logger.LogInformation(
                "Audit Event: BudgetAlertEmailSent | BudgetId={BudgetId} | ServiceLineId={ServiceLineId} | Threshold={Threshold}",
                message.BudgetId, message.ServiceLineId, message.ThresholdPercent);

            return BudgetAlertEmailDeliveryResult.Sent();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to send budget alert email for BudgetId={BudgetId} ServiceLineId={ServiceLineId}.",
                message.BudgetId, message.ServiceLineId);

            return BudgetAlertEmailDeliveryResult.Failed("Budget alert email failed to send.");
        }
    }

    private static string Money(decimal amount) =>
        amount.ToString("N3", CultureInfo.InvariantCulture) + " TND";

    private static string BuildTextBody(BudgetAlertEmailMessage m, BudgetAlertEmailOptions options) =>
        $"Training budget alert.{Environment.NewLine}{Environment.NewLine}" +
        $"Service line {m.ServiceLineName} has reached {m.ThresholdPercent}% of its training budget.{Environment.NewLine}" +
        $"Allocated: {Money(m.AllocatedAmount)}{Environment.NewLine}" +
        $"Spent: {Money(m.SpendAmount)}{Environment.NewLine}" +
        $"Consumed: {m.PercentConsumed.ToString("N1", CultureInfo.InvariantCulture)}%{Environment.NewLine}" +
        $"Period: {m.PeriodStart:yyyy-MM-dd} to {m.PeriodEnd:yyyy-MM-dd}{Environment.NewLine}{Environment.NewLine}" +
        $"Regards,{Environment.NewLine}{options.FromName}";

    private static string BuildHtmlBody(BudgetAlertEmailMessage m, BudgetAlertEmailOptions options)
    {
        var slName = WebUtility.HtmlEncode(m.ServiceLineName);
        var brandName = WebUtility.HtmlEncode(options.FromName);
        var allocated = WebUtility.HtmlEncode(Money(m.AllocatedAmount));
        var spent = WebUtility.HtmlEncode(Money(m.SpendAmount));
        var consumed = WebUtility.HtmlEncode(m.PercentConsumed.ToString("N1", CultureInfo.InvariantCulture) + "%");
        var period = WebUtility.HtmlEncode($"{m.PeriodStart:yyyy-MM-dd} to {m.PeriodEnd:yyyy-MM-dd}");
        var accent = m.ThresholdPercent >= 100 ? "#b9251c" : m.ThresholdPercent >= 90 ? "#d97706" : "#ca8a04";

        return $$"""
            <!doctype html>
            <html lang="en">
            <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
            <body style="margin:0; padding:24px; background:#f5f5f5; font-family:Segoe UI, Arial, sans-serif; color:#1a1a24;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
                    <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(2,12,27,0.12);">
                        <tr><td style="padding:28px 32px; background:{{accent}}; color:#ffffff;">
                            <h1 style="margin:0; font-size:24px; line-height:30px; font-weight:700;">Budget alert — {{m.ThresholdPercent}}% reached</h1>
                            <p style="margin:10px 0 0 0; font-size:14px; line-height:22px;">Service line {{slName}} has reached {{m.ThresholdPercent}}% of its training budget.</p>
                        </td></tr>
                        <tr><td style="padding:24px 32px; font-size:14px; line-height:24px; color:#1a1a24;">
                            <p style="margin:0;"><strong>Allocated:</strong> {{allocated}}</p>
                            <p style="margin:6px 0 0 0;"><strong>Spent:</strong> {{spent}}</p>
                            <p style="margin:6px 0 0 0;"><strong>Consumed:</strong> {{consumed}}</p>
                            <p style="margin:6px 0 0 0;"><strong>Period:</strong> {{period}}</p>
                        </td></tr>
                        <tr><td style="padding:16px 32px 24px 32px; border-top:1px solid #e7e7ec; color:#555566; font-size:12px; line-height:18px;">Regards,<br/>{{brandName}}</td></tr>
                    </table>
                </td></tr></table>
            </body>
            </html>
            """;
    }
}
