using System.Net;
using System.Net.Mail;
using EY.HRPlatform.Training.Features.Calendar.Invites;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Training.Features.Calendar.Reminders;

public sealed record ReminderEmailMessage(string ToEmail, string? ToName, string Subject, string Body);

/// <summary>Sends a plain-text session reminder email (reuses the Email:Calendar SMTP config).</summary>
public interface IReminderEmailSender
{
    Task SendAsync(ReminderEmailMessage message, CancellationToken cancellationToken);
}

public sealed class SmtpReminderEmailSender : IReminderEmailSender
{
    private readonly CalendarEmailOptions _options;
    private readonly ILogger<SmtpReminderEmailSender> _logger;

    public SmtpReminderEmailSender(IOptions<CalendarEmailOptions> options, ILogger<SmtpReminderEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(ReminderEmailMessage message, CancellationToken cancellationToken)
    {
        using var mail = new MailMessage
        {
            From = new MailAddress(_options.FromEmail, _options.FromName),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = false,
        };
        mail.To.Add(new MailAddress(message.ToEmail, message.ToName ?? message.ToEmail));

        using var client = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
        {
            EnableSsl = _options.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Timeout = 30_000,
        };
        if (!string.IsNullOrWhiteSpace(_options.Username))
            client.Credentials = new NetworkCredential(_options.Username, _options.Password ?? string.Empty);

        await client.SendMailAsync(mail, cancellationToken);
        _logger.LogInformation("Sent reminder to {Email}: {Subject}", message.ToEmail, message.Subject);
    }
}

public sealed class NoOpReminderEmailSender : IReminderEmailSender
{
    private readonly ILogger<NoOpReminderEmailSender> _logger;

    public NoOpReminderEmailSender(ILogger<NoOpReminderEmailSender> logger) => _logger = logger;

    public Task SendAsync(ReminderEmailMessage message, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Reminder suppressed (no email provider): {Email} {Subject}", message.ToEmail, message.Subject);
        return Task.CompletedTask;
    }
}
