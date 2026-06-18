using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using EY.HRPlatform.Training.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Training.Features.Calendar.Invites;

/// <summary>
/// Default invite sync: an iMIP email (a <c>text/calendar; method=REQUEST|CANCEL</c> alternate part
/// plus an <c>invite.ics</c> attachment) sent over SMTP via System.Net.Mail. Throws on a delivery
/// failure so the outbox drain can retry.
/// </summary>
public sealed class ImipEmailInviteSync : ISessionInviteSync
{
    private readonly CalendarEmailOptions _options;
    private readonly IcsInviteBuilder _builder;
    private readonly ILogger<ImipEmailInviteSync> _logger;

    public ImipEmailInviteSync(
        IOptions<CalendarEmailOptions> options,
        IcsInviteBuilder builder,
        ILogger<ImipEmailInviteSync> logger)
    {
        _options = options.Value;
        _builder = builder;
        _logger = logger;
    }

    public async Task SendAsync(SessionInviteMessage message, CancellationToken cancellationToken)
    {
        var ics = _builder.Build(message);
        var methodToken = message.Method == InviteMethod.Cancel ? "CANCEL" : "REQUEST";

        using var mail = new MailMessage
        {
            From = new MailAddress(_options.FromEmail, _options.FromName),
            Subject = (message.Method == InviteMethod.Cancel ? "Cancelled: " : string.Empty) + message.Title,
            Body = BuildTextBody(message),
            IsBodyHtml = false,
        };
        mail.To.Add(new MailAddress(message.Recipient.Email, message.Recipient.Name ?? message.Recipient.Email));

        // multipart/alternative (text + text/calendar) is the structure clients key Accept/Decline
        // off — no separate .ics attachment (which can demote the message to "has an attachment").
        // Base64 transfer-encoding so non-ASCII (em-dash, accents) survives transport intact.
        var calendarView = AlternateView.CreateAlternateViewFromString(ics, Encoding.UTF8, "text/calendar");
        calendarView.ContentType.Parameters["method"] = methodToken;
        calendarView.ContentType.Parameters["charset"] = "utf-8";
        calendarView.TransferEncoding = TransferEncoding.Base64;
        mail.AlternateViews.Add(calendarView);

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

        _logger.LogInformation(
            "Sent iMIP {Method} (uid={Uid} seq={Seq}) to {Email}.",
            methodToken, message.ICalUid, message.Sequence, message.Recipient.Email);
    }

    private static string BuildTextBody(SessionInviteMessage m)
    {
        var when = $"{m.StartUtc:yyyy-MM-dd HH:mm} – {m.EndUtc:HH:mm} UTC";
        var lines = new List<string>
        {
            m.Method == InviteMethod.Cancel
                ? $"The following training session has been cancelled: {m.Title}"
                : $"You are enrolled in: {m.Title}",
            $"When: {when}",
        };
        if (!string.IsNullOrWhiteSpace(m.Location)) lines.Add($"Where: {m.Location}");
        lines.Add(string.Empty);
        lines.Add("This message contains a calendar invitation.");
        return string.Join(Environment.NewLine, lines);
    }
}
