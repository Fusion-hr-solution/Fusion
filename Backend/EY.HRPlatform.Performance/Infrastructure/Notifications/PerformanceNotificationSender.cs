using System.Net;
using System.Net.Mail;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Notifications;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

public sealed class PerformanceNotificationOptions
{
    public bool Enabled { get; set; }
    public string ShellBaseUrl { get; set; } = string.Empty;
    public PerformanceSmtpOptions Smtp { get; set; } = new();
}

public sealed class PerformanceSmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string From { get; set; } = string.Empty;
    public bool UseSsl { get; set; } = true;
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed record PerformanceNotificationEmail(string Subject, string Body);

public static class PerformanceNotificationRenderer
{
    public static PerformanceNotificationEmail Render(PerformanceOutboxMessage message, string shellBaseUrl)
    {
        if (!Uri.TryCreate(shellBaseUrl, UriKind.Absolute, out var shell) || shell.Scheme is not ("https" or "http"))
            throw new InvalidOperationException("Notifications:ShellBaseUrl must be an absolute shell URL.");
        if (message.ResourceType == "CalibrationSession")
        {
            var calibration = JsonSerializer.Deserialize<CalibrationNotificationPayload>(message.Payload)
                ?? throw new InvalidOperationException("Notification calibration context is missing.");
            if (calibration.SessionId != message.ResourceId || calibration.ReviewRoundId == Guid.Empty
                || message.Kind != PerformanceNotificationKind.CalibrationReady)
                throw new InvalidOperationException("Notification calibration context does not match its resource.");
            var calibrationLink = $"{shellBaseUrl.TrimEnd('/')}/performance/reviews/rounds/{calibration.ReviewRoundId}/calibration";
            return new("Calibration is ready",
                $"Every review in {calibration.ReviewRoundName} has reached calibration.\n\nOpen calibration: {calibrationLink}");
        }
        if (message.Kind is PerformanceNotificationKind.ObjectiveAtRisk or PerformanceNotificationKind.UpdateRequestAnswered
            or PerformanceNotificationKind.DevelopmentGoalAdded)
        {
            var path = JsonSerializer.Deserialize<PathNotificationPayload>(message.Payload)
                ?? throw new InvalidOperationException("Notification context is missing.");
            if (path.ResourceId != message.ResourceId || !path.Path.StartsWith("/performance/", StringComparison.Ordinal))
                throw new InvalidOperationException("Notification context does not match its resource.");
            var pathLink = $"{shellBaseUrl.TrimEnd('/')}{path.Path}";
            var actor = path.ActorDisplayName ?? "Someone";
            // The owner's reason stays out of email; the link opens it for those allowed to read it.
            return message.Kind switch
            {
                PerformanceNotificationKind.ObjectiveAtRisk => new("An objective needs your attention",
                    $"{actor} reported that one of their objectives is at risk or off track.\n\nOpen objective: {pathLink}"),
                PerformanceNotificationKind.UpdateRequestAnswered => new("Progress updated",
                    $"{actor} recorded progress after your request.\n\nOpen: {pathLink}"),
                _ => new("New development goal",
                    $"{actor} added a development goal.\n\nOpen development: {pathLink}"),
            };
        }
        if (PerformanceOutboxMessage.IsConversationKind(message.Kind))
        {
            var conversation = JsonSerializer.Deserialize<ConversationNotificationPayload>(message.Payload)
                ?? throw new InvalidOperationException("Notification context is missing.");
            if (conversation.ResourceId != message.ResourceId || !conversation.Path.StartsWith("/performance/", StringComparison.Ordinal))
                throw new InvalidOperationException("Notification context does not match its resource.");
            var conversationLink = $"{shellBaseUrl.TrimEnd('/')}{conversation.Path}";
            var who = conversation.ActorDisplayName ?? "A colleague";
            // Names and kinds only: feedback, answers, notes, actions and praise messages stay in the app.
            return message.Kind switch
            {
                PerformanceNotificationKind.OneOnOneStarted => new("Your 1:1s have started",
                    $"{who} started recurring 1:1s with you.\n\nOpen your 1:1s: {conversationLink}"),
                PerformanceNotificationKind.OneOnOneRescheduled => new("Your next 1:1 moved",
                    $"{who} moved your next 1:1.\n\nOpen your 1:1s: {conversationLink}"),
                PerformanceNotificationKind.OneOnOneActionAssigned => new("A 1:1 action for you",
                    $"{who} gave you an action item from your 1:1.\n\nOpen your 1:1s: {conversationLink}"),
                PerformanceNotificationKind.FeedbackReceived => new("You have new feedback",
                    $"{who} gave you feedback.\n\nRead it: {conversationLink}"),
                PerformanceNotificationKind.FeedbackForReport => new("Feedback about someone on your team",
                    $"{who} gave you manager-only feedback about someone on your team.\n\nRead it: {conversationLink}"),
                PerformanceNotificationKind.FeedbackRequested => new("A colleague asked for your feedback",
                    $"{who} asked for your feedback.\n\nOpen the request: {conversationLink}"),
                PerformanceNotificationKind.FeedbackRequestResponded => new("A response to your feedback request",
                    $"{who} responded to your feedback request.\n\nOpen the request: {conversationLink}"),
                PerformanceNotificationKind.PraiseReceived => new("You were praised",
                    $"{who} praised you.\n\nSee it: {conversationLink}"),
                _ => new("Someone on your team was praised",
                    $"{who} praised someone on your team.\n\nSee it: {conversationLink}"),
            };
        }
        if (message.ResourceType == "PerformanceReview")
        {
            var review = JsonSerializer.Deserialize<ReviewNotificationPayload>(message.Payload)
                ?? throw new InvalidOperationException("Notification review context is missing.");
            if (review.ReviewId != message.ResourceId || review.CycleId == Guid.Empty || review.ReviewRoundId == Guid.Empty)
                throw new InvalidOperationException("Notification review context does not match its resource.");
            var reviewLink = $"{shellBaseUrl.TrimEnd('/')}/performance/reviews/{review.ReviewId}";
            return message.Kind switch
            {
                PerformanceNotificationKind.SelfAssessmentOpened => new("Your self-assessment is open",
                    $"The {review.ReviewRoundName} review is ready for your self-assessment.\n\nOpen review: {reviewLink}"),
                PerformanceNotificationKind.ManagerAssessmentOpened => new("A review is ready for your assessment",
                    $"The {review.ReviewRoundName} review is ready for your assessment.\n\nOpen review: {reviewLink}"),
                PerformanceNotificationKind.SelfAssessmentSubmitted => new("A self-assessment is ready for your review",
                    $"A self-assessment in {review.ReviewRoundName} has been submitted.\n\nOpen review: {reviewLink}"),
                PerformanceNotificationKind.ReviewFinalized => new("Your performance review is available",
                    $"Your {review.ReviewRoundName} review has been finalized.\n\nOpen review: {reviewLink}"),
                _ => throw new InvalidOperationException("Unsupported review notification kind."),
            };
        }

        var payload = JsonSerializer.Deserialize<PlanNotificationPayload>(message.Payload)
            ?? throw new InvalidOperationException("Notification plan context is missing.");
        if (payload.PlanId != message.ResourceId || payload.CycleId == Guid.Empty)
            throw new InvalidOperationException("Notification plan context does not match its resource.");
        var link = $"{shellBaseUrl.TrimEnd('/')}/performance/cycles/{payload.CycleId}/plans/{payload.PlanId}";
        return message.Kind switch
        {
            PerformanceNotificationKind.PlanSubmitted => new("Plan ready for your review",
                $"{payload.ActorDisplayName ?? "An employee"} submitted a plan for your review.\n\nOpen plan: {link}"),
            PerformanceNotificationKind.PlanReturned => new("Your plan needs changes",
                $"Your plan was returned for changes. Open it to see the feedback.\n\nOpen plan: {link}"),
            PerformanceNotificationKind.UpdateRequested => new("Progress update requested",
                $"{payload.ActorDisplayName ?? "Your reviewer"} asked you to update your progress.\n\nOpen plan: {link}"),
            PerformanceNotificationKind.PlanApproved => new("Your plan is approved",
                $"Your plan was approved. You can now record progress.\n\nOpen plan: {link}"),
            _ => throw new InvalidOperationException("Unsupported notification kind."),
        };
    }
}

public interface IPerformanceNotificationSender
{
    Task SendAsync(PerformanceOutboxMessage message, string recipientEmail, CancellationToken cancellationToken);
}

public sealed class SmtpPerformanceNotificationSender(IOptions<PerformanceNotificationOptions> options) : IPerformanceNotificationSender
{
    public async Task SendAsync(PerformanceOutboxMessage message, string recipientEmail, CancellationToken cancellationToken)
    {
        var config = options.Value;
        var rendered = PerformanceNotificationRenderer.Render(message, config.ShellBaseUrl);
        using var mail = new MailMessage
        {
            From = new MailAddress(config.Smtp.From), Subject = rendered.Subject,
            Body = rendered.Body, IsBodyHtml = false,
        };
        mail.To.Add(recipientEmail);
        // Stable identity for the same durable message; do not include business content in headers.
        mail.Headers.Add("Message-ID", $"<{message.Id:N}@fusion-performance>");
        using var smtp = new SmtpClient(config.Smtp.Host, config.Smtp.Port)
        {
            EnableSsl = config.Smtp.UseSsl, DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
        };
        if (!string.IsNullOrWhiteSpace(config.Smtp.Username))
            smtp.Credentials = new NetworkCredential(config.Smtp.Username, config.Smtp.Password ?? string.Empty);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        await smtp.SendMailAsync(mail, timeout.Token);
    }
}
