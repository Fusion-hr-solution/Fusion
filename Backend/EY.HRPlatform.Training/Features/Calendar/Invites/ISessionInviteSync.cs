using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Features.Calendar.Invites;

public sealed record SessionInviteRecipient(Guid EmployeeId, string Email, string? Name);

public sealed record SessionInviteMessage(
    string ICalUid,
    int Sequence,
    InviteMethod Method,
    SessionInviteRecipient Recipient,
    string OrganizerEmail,
    string OrganizerName,
    string Title,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Location,
    string? Description);

/// <summary>
/// Provider seam for pushing a session invite to ONE attendee. The default implementation is iMIP
/// email (REQUEST/CANCEL); a Graph adapter is a future option; NoOp disables sync. The outbox drain
/// retries on failure, so implementations should THROW on a transient delivery failure.
/// </summary>
public interface ISessionInviteSync
{
    Task SendAsync(SessionInviteMessage message, CancellationToken cancellationToken);
}
