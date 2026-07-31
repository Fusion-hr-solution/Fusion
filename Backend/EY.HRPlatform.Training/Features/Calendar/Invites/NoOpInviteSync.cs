using Microsoft.Extensions.Logging;

namespace EY.HRPlatform.Training.Features.Calendar.Invites;

/// <summary>Disabled invite sync (Calendar:InviteProvider = None, or SMTP not configured).</summary>
public sealed class NoOpInviteSync : ISessionInviteSync
{
    private readonly ILogger<NoOpInviteSync> _logger;

    public NoOpInviteSync(ILogger<NoOpInviteSync> logger) => _logger = logger;

    public Task SendAsync(SessionInviteMessage message, CancellationToken cancellationToken)
    {
        _logger.LogDebug(
            "Calendar invite suppressed (no provider): {Method} uid={Uid} seq={Seq} to {Email}.",
            message.Method, message.ICalUid, message.Sequence, message.Recipient.Email);
        return Task.CompletedTask;
    }
}
