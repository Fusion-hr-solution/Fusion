using System.Text.Json;
using EY.HRPlatform.Identity.Features.Invitations;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Identity.Features.WorkforceAccounts;

/// <summary>One captured workforce invitation, retained whole for inspection and demo.</summary>
public sealed record CapturedWorkforceInvitation(
    string Subject,
    string Html,
    string Text,
    string Email,
    string TenantName,
    string ActivationLink,
    DateTime CapturedAtUtc);

/// <summary>
/// Local delivery for development and tests, mirroring the bootstrap capture sender so
/// the workforce invitation can be opened as the real rendered message during a demo
/// rather than a link copied from a console. It reports Sent without sending and uses
/// the same canonical renderer as SMTP, so what is captured is exactly what would be
/// delivered.
///
/// Registered only in Development. The captured files carry the activation link, so it
/// is never a production customer feature.
/// </summary>
public sealed class CapturedWorkforceInvitationEmailSender(
    IOptions<BootstrapInvitationCaptureOptions> optionsAccessor,
    ILogger<CapturedWorkforceInvitationEmailSender> logger) : IWorkforceInvitationEmailSender
{
    private static readonly Lock Gate = new();
    private static readonly List<CapturedWorkforceInvitation> Captured = [];

    /// <summary>Newest first, so a test reads the message it just triggered.</summary>
    public static IReadOnlyList<CapturedWorkforceInvitation> Messages
    {
        get { lock (Gate) return [.. Captured]; }
    }

    public static CapturedWorkforceInvitation? LastFor(string email)
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

    public Task<WorkforceInvitationDeliveryResult> SendInviteAsync(
        WorkforceInvitationEmailMessage invitation,
        CancellationToken cancellationToken)
    {
        // The same reserved bounce address the bootstrap path honours, so recovery
        // from a failed workforce delivery is reachable locally against a real invite.
        if (BootstrapDeliveryProbe.IsUndeliverable(invitation.Email))
        {
            logger.LogWarning(
                "[development] Workforce delivery refused for reserved address {Email}", invitation.Email);
            return Task.FromResult(WorkforceInvitationDeliveryResult.Failed(
                "Email failed. Manual link available."));
        }

        RenderedInvitation rendered = WorkforceInvitationMailAssembly.Render(invitation);
        var captured = new CapturedWorkforceInvitation(
            rendered.Subject,
            rendered.Html,
            rendered.Text,
            invitation.Email,
            invitation.TenantName,
            invitation.InviteLink,
            DateTime.UtcNow);

        lock (Gate) Captured.Add(captured);

        TryWrite(captured);
        return Task.FromResult(WorkforceInvitationDeliveryResult.Sent("Captured for development."));
    }

    /// <summary>
    /// Writing the message to disk is a local-demo convenience, not the capture
    /// itself: a filesystem problem must not become a delivery failure.
    /// </summary>
    private void TryWrite(CapturedWorkforceInvitation captured)
    {
        try
        {
            var directory = optionsAccessor.Value.Directory;
            Directory.CreateDirectory(directory);

            var stamp = captured.CapturedAtUtc.ToString("yyyyMMdd-HHmmss-fff");
            var slug = new string(captured.Email
                .Select(character => char.IsLetterOrDigit(character) ? character : '-')
                .ToArray());

            var basePath = Path.Combine(directory, $"{stamp}_workforce_{slug}");
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
                "[development] Workforce invitation captured for {Email} at {Path}.html",
                captured.Email, basePath);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "[development] Could not write the captured workforce invitation to disk.");
        }
    }
}
