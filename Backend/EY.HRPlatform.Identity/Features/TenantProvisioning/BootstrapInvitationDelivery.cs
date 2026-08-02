using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public interface IBootstrapInvitationDelivery
{
    /// <summary>
    /// Requests delivery of a bootstrap link and records exactly one attempt.
    /// Never throws: a delivery problem must not unwind committed provisioning.
    /// </summary>
    Task DeliverAsync(
        Guid invitationId,
        string email,
        BootstrapCredential credential,
        Guid initiatedByAccountId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Post-commit delivery. Each completed request writes one Sent or Failed
/// attempt — there is no Started or Unknown state, so no lease, inference window
/// or reconciliation job is needed to interpret the record.
/// </summary>
public sealed class BootstrapInvitationDelivery(
    AppIdentityDbContext dbContext,
    IBootstrapInvitationEmailSender emailSender,
    IConfiguration configuration,
    ILogger<BootstrapInvitationDelivery> logger) : IBootstrapInvitationDelivery
{
    public async Task DeliverAsync(
        Guid invitationId,
        string email,
        BootstrapCredential credential,
        Guid initiatedByAccountId,
        CancellationToken cancellationToken = default)
    {
        var link = BootstrapActivationLinkBuilder.Build(configuration, credential.RawValue);

        InvitationDeliveryAttempt attempt;
        try
        {
            var outcome = await emailSender.SendAsync(email, link, cancellationToken);

            attempt = outcome.Succeeded
                ? InvitationDeliveryAttempt.Sent(invitationId, initiatedByAccountId)
                : InvitationDeliveryAttempt.Failed(
                    invitationId, Sanitize(outcome.FailureCode), initiatedByAccountId);
        }
        catch (Exception exception)
        {
            // The raw provider error may carry recipient data or internal detail,
            // so only a bounded code is persisted. The detail goes to logs.
            logger.LogWarning(exception, "Bootstrap invitation delivery failed for {InvitationId}", invitationId);
            attempt = InvitationDeliveryAttempt.Failed(
                invitationId, "delivery_error", initiatedByAccountId);
        }

        dbContext.InvitationDeliveryAttempts.Add(attempt);

        var invitation = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == invitationId, cancellationToken);

        if (invitation is not null)
        {
            dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
                TenantBootstrapAuditEventType.InvitationDeliveryAttempted,
                invitation.TenantId,
                correlationId: Guid.NewGuid(),
                outcome: attempt.Outcome.ToString(),
                invitationId: invitationId,
                actorAccountId: initiatedByAccountId,
                reason: attempt.SanitizedFailureCode));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Keeps the stored code bounded and free of provider text.</summary>
    private static string Sanitize(string? failureCode)
    {
        if (string.IsNullOrWhiteSpace(failureCode))
            return "delivery_failed";

        var trimmed = failureCode.Trim();
        return trimmed.Length <= 64 ? trimmed : trimmed[..64];
    }
}

public sealed record BootstrapDeliveryOutcome(bool Succeeded, string? FailureCode)
{
    public static BootstrapDeliveryOutcome Sent() => new(true, null);
    public static BootstrapDeliveryOutcome Failed(string failureCode) => new(false, failureCode);
}

public interface IBootstrapInvitationEmailSender
{
    Task<BootstrapDeliveryOutcome> SendAsync(string email, string activationLink, CancellationToken cancellationToken);
}

/// <summary>
/// Development-only sender. It writes the activation link to the log so the
/// local demonstration can pick it up from development mail capture — which is
/// exactly why it must never be registered outside Development: the link
/// contains the reusable bootstrap secret, and reporting Sent without sending
/// would show a false success.
/// </summary>
public sealed class LoggingBootstrapInvitationEmailSender(
    ILogger<LoggingBootstrapInvitationEmailSender> logger) : IBootstrapInvitationEmailSender
{
    /// <summary>
    /// Reserved development domain that always fails delivery.
    ///
    /// Recovery from a bounced invitation is a specified behaviour, and it is
    /// otherwise unreachable locally because this sender always succeeds. Making
    /// the failure reproducible here produces a genuine Failed attempt on a real
    /// invitation, rather than a fabricated record staged for a screenshot.
    /// `.test` is reserved by RFC 2606, so this can never shadow a real domain.
    /// </summary>
    public const string UndeliverableDomain = "@bounce.test";

    public Task<BootstrapDeliveryOutcome> SendAsync(
        string email,
        string activationLink,
        CancellationToken cancellationToken)
    {
        if (email.EndsWith(UndeliverableDomain, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning(
                "[development] Simulated delivery failure for reserved address {Email}", email);
            return Task.FromResult(BootstrapDeliveryOutcome.Failed("delivery_rejected"));
        }

        logger.LogInformation(
            "[development] Bootstrap invitation for {Email}: {ActivationLink}", email, activationLink);
        return Task.FromResult(BootstrapDeliveryOutcome.Sent());
    }
}

/// <summary>
/// Stands in for a real provider outside Development until one is configured.
///
/// It records a truthful Failed attempt rather than claiming delivery, so the
/// invitation stays Pending and visibly recoverable instead of appearing sent.
/// The credential is never written to logs.
/// </summary>
public sealed class UnconfiguredBootstrapInvitationEmailSender(
    ILogger<UnconfiguredBootstrapInvitationEmailSender> logger) : IBootstrapInvitationEmailSender
{
    public Task<BootstrapDeliveryOutcome> SendAsync(
        string email,
        string activationLink,
        CancellationToken cancellationToken)
    {
        logger.LogError(
            "Bootstrap invitation delivery is not configured; no email was sent. "
            + "Configure a provider before provisioning tenants outside development.");
        return Task.FromResult(BootstrapDeliveryOutcome.Failed("delivery_not_configured"));
    }
}

/// <summary>
/// Builds the shell-owned activation link. Bootstrap activation is a distinct
/// destination from the workforce invite route, which keeps its own behavior.
/// </summary>
public static class BootstrapActivationLinkBuilder
{
    private const string DefaultPublicBaseUrl = "http://localhost:3000";
    private const string ActivationPath = "/activate-invitation";

    public static string Build(IConfiguration configuration, string credential)
        => Build(configuration["Application:PublicBaseUrl"], credential);

    public static string Build(string? publicBaseUrl, string credential)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(credential);

        var baseUrl = string.IsNullOrWhiteSpace(publicBaseUrl)
            ? DefaultPublicBaseUrl
            : publicBaseUrl.TrimEnd('/');

        return $"{baseUrl}{ActivationPath}?credential={Uri.EscapeDataString(credential)}";
    }
}
