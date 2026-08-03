using System.Text.Json;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public sealed class BootstrapInvitationCaptureOptions
{
    public const string SectionName = "BootstrapInvitationCapture";

    /// <summary>
    /// Where captured messages are written. Defaults beside the running service so
    /// a developer can find them without configuring anything.
    /// </summary>
    public string Directory { get; set; } =
        Path.Combine(AppContext.BaseDirectory, "mail-capture");
}

/// <summary>
/// One captured message, retained whole.
/// </summary>
public sealed record CapturedBootstrapInvitation(
    string Subject,
    string Html,
    string Text,
    string Email,
    string TenantName,
    string ActivationLink,
    DateTime CapturedAtUtc);

/// <summary>
/// Local delivery for development and tests.
///
/// It replaces the previous log line, which could only ever prove that a link was
/// produced. Retaining the rendered message means a test can assert on what the
/// recipient would actually read, and the local demonstration can open the real
/// message instead of a link copied out of a console.
///
/// It is registered only in Development: it reports Sent without sending, and the
/// files it writes contain the reusable bootstrap credential.
/// </summary>
public sealed class CapturedBootstrapInvitationEmailSender(
    IOptions<BootstrapInvitationCaptureOptions> optionsAccessor,
    ILogger<CapturedBootstrapInvitationEmailSender> logger) : IBootstrapInvitationEmailSender
{
    private static readonly Lock Gate = new();
    private static readonly List<CapturedBootstrapInvitation> Captured = [];

    /// <summary>Newest first, so a test reads the message it just triggered.</summary>
    public static IReadOnlyList<CapturedBootstrapInvitation> Messages
    {
        get { lock (Gate) return [.. Captured]; }
    }

    public static CapturedBootstrapInvitation? LastFor(string email)
    {
        lock (Gate)
        {
            return Captured.LastOrDefault(
                item => string.Equals(item.Email, email, StringComparison.OrdinalIgnoreCase));
        }
    }

    public static void Clear()
    {
        lock (Gate) Captured.Clear();
    }

    public Task<BootstrapDeliveryOutcome> SendAsync(
        BootstrapInvitationMessage message,
        CancellationToken cancellationToken)
    {
        // A reserved address that always bounces, so recovery from a failed
        // delivery is reachable locally against a genuine invitation.
        if (BootstrapDeliveryProbe.IsUndeliverable(message.Email))
        {
            logger.LogWarning(
                "[development] Delivery refused for reserved address {Email}", message.Email);
            return Task.FromResult(BootstrapDeliveryOutcome.Failed("delivery_rejected"));
        }

        var rendered = BootstrapInvitationTemplate.Render(message);
        var captured = new CapturedBootstrapInvitation(
            rendered.Subject,
            rendered.Html,
            rendered.Text,
            message.Email,
            message.TenantName,
            message.ActivationLink,
            DateTime.UtcNow);

        lock (Gate) Captured.Add(captured);

        TryWrite(captured);
        return Task.FromResult(BootstrapDeliveryOutcome.Sent());
    }

    /// <summary>
    /// Writing the message to disk is a convenience for the local demonstration,
    /// not the capture itself. A filesystem problem must not turn into a delivery
    /// failure the operator has to diagnose.
    /// </summary>
    private void TryWrite(CapturedBootstrapInvitation captured)
    {
        try
        {
            var directory = optionsAccessor.Value.Directory;
            System.IO.Directory.CreateDirectory(directory);

            var stamp = captured.CapturedAtUtc.ToString("yyyyMMdd-HHmmss-fff");
            var slug = new string(captured.Email
                .Select(character => char.IsLetterOrDigit(character) ? character : '-')
                .ToArray());

            var basePath = Path.Combine(directory, $"{stamp}_{slug}");
            File.WriteAllText($"{basePath}.html", captured.Html);
            File.WriteAllText($"{basePath}.txt", captured.Text);
            File.WriteAllText($"{basePath}.json", JsonSerializer.Serialize(new
            {
                captured.Subject,
                captured.Email,
                captured.TenantName,
                captured.ActivationLink,
                captured.CapturedAtUtc,
            }, new JsonSerializerOptions { WriteIndented = true }));

            logger.LogInformation(
                "[development] Bootstrap invitation captured for {Email} at {Path}.html",
                captured.Email, basePath);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "[development] Could not write the captured invitation to disk.");
        }
    }
}
