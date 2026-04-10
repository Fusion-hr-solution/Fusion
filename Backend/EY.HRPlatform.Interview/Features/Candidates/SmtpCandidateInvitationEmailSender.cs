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
            Body = options.UseHtmlBody ? BuildHtmlBody(invitation) : BuildTextBody(invitation),
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
        var candidate = string.IsNullOrWhiteSpace(invitation.CandidateName) ? "Candidate" : invitation.CandidateName.Trim();
        var deadline = TryFormatDeadline(invitation.DeadlineUtc) ?? "No deadline";

        return
            $"Hello {candidate},{Environment.NewLine}{Environment.NewLine}" +
            $"You have been invited to take the test '{invitation.TestTitle}'.{Environment.NewLine}" +
            $"Deadline: {deadline}{Environment.NewLine}" +
            $"Invitation link: {invitation.InviteLink}{Environment.NewLine}{Environment.NewLine}" +
            "Regards," + Environment.NewLine +
            "EY HR Platform";
    }

    private static string BuildHtmlBody(CandidateInvitationDto invitation)
    {
        var candidate = WebUtility.HtmlEncode(
            string.IsNullOrWhiteSpace(invitation.CandidateName) ? "Candidate" : invitation.CandidateName.Trim());
        var testTitle = WebUtility.HtmlEncode(invitation.TestTitle);
        var deadline = WebUtility.HtmlEncode(TryFormatDeadline(invitation.DeadlineUtc) ?? "No deadline");
        var inviteLink = WebUtility.HtmlEncode(invitation.InviteLink);

        return $"""
            <p>Hello {candidate},</p>
            <p>You have been invited to take the test <strong>{testTitle}</strong>.</p>
            <p><strong>Deadline:</strong> {deadline}</p>
            <p>
                <a href=\"{inviteLink}\">Open invitation</a>
            </p>
            <p>Regards,<br/>EY HR Platform</p>
            """;
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