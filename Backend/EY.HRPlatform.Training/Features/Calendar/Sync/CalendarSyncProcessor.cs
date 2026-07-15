using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Invites;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Training.Features.Calendar.Sync;

/// <summary>
/// Processes a single <see cref="CalendarSyncOutbox"/> row: resolves the session + recipients,
/// manages the canonical UID/SEQUENCE on <see cref="ExternalCalendarSync"/>, and pushes invites via
/// <see cref="ISessionInviteSync"/> with per-attendee idempotency (<see cref="SessionInviteDelivery"/>).
/// Retry-safe: the SEQUENCE bump is applied once (AppliedSequence) and each delivery is persisted
/// immediately after a successful send, so a mid-batch failure never double-invites on retry.
/// </summary>
public sealed class CalendarSyncProcessor
{
    private readonly TrainingDbContext _db;
    private readonly ISessionInviteSync _sync;
    private readonly CalendarEmailOptions _email;

    public CalendarSyncProcessor(
        TrainingDbContext db,
        ISessionInviteSync sync,
        IOptions<CalendarEmailOptions> email)
    {
        _db = db;
        _sync = sync;
        _email = email.Value;
    }

    public async Task ProcessAsync(CalendarSyncOutbox row, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingSessions
            .Include(s => s.Part).ThenInclude(p => p.Training)
            .FirstOrDefaultAsync(s => s.Id == row.SessionId, cancellationToken);

        if (session is null)
        {
            // Session no longer exists — nothing to deliver.
            row.MarkProcessed();
            await _db.SaveChangesAsync(cancellationToken);
            return;
        }

        var sync = await _db.ExternalCalendarSyncs
            .FirstOrDefaultAsync(x => x.SessionId == row.SessionId, cancellationToken);
        if (sync is null)
        {
            sync = new ExternalCalendarSync(
                row.SessionId, $"session-{row.SessionId:D}@fusion-training", CalendarProvider.Imip);
            _db.ExternalCalendarSyncs.Add(sync);
        }

        var method = row.Type is CalendarSyncType.AttendeeRemoved or CalendarSyncType.SessionCancelled
            ? InviteMethod.Cancel
            : InviteMethod.Request;

        // A cancelled session's canonical event must never be re-REQUESTed (e.g. a reschedule row
        // that lost ordering to the cancel) — drop it.
        if (sync.Status == CalendarSyncStatus.Cancelled && method == InviteMethod.Request)
        {
            row.MarkProcessed();
            await _db.SaveChangesAsync(cancellationToken);
            return;
        }

        // Bump the canonical SEQUENCE once per change-row — including attendee-removal, so a CANCEL
        // strictly outranks the REQUEST it supersedes. Idempotent across retries via AppliedSequence.
        var bumpsSequence = row.Type is CalendarSyncType.SessionRescheduled
            or CalendarSyncType.SessionCancelled
            or CalendarSyncType.AttendeeRemoved;

        if (row.AppliedSequence is null)
        {
            if (bumpsSequence) sync.BumpSequence();
            if (row.Type == CalendarSyncType.SessionCancelled) sync.MarkCancelled();
            row.RecordApplied(sync.Sequence);
            await _db.SaveChangesAsync(cancellationToken);
        }

        var sequence = row.AppliedSequence!.Value;
        var recipients = await ResolveRecipientsAsync(row, cancellationToken);

        var title = $"{session.Part.Training.Title} — {session.Part.Title}";
        var location = !string.IsNullOrWhiteSpace(session.MeetingUrl)
            ? session.MeetingUrl
            : string.IsNullOrWhiteSpace(session.Room) ? null : session.Room;
        var description = string.IsNullOrWhiteSpace(session.TrainerName) ? null : $"Trainer: {session.TrainerName}";

        foreach (var r in recipients)
        {
            if (string.IsNullOrWhiteSpace(r.Email)) continue;

            var delivery = await _db.SessionInviteDeliveries
                .FirstOrDefaultAsync(d => d.SessionId == row.SessionId && d.EmployeeId == r.EmployeeId, cancellationToken);
            if (delivery is null)
            {
                delivery = new SessionInviteDelivery(row.SessionId, r.EmployeeId, r.Email, r.Name);
                _db.SessionInviteDeliveries.Add(delivery);
            }

            // Never CANCEL an attendee who was never sent a REQUEST (e.g. a session cancelled before
            // their invite went out, or while the provider was disabled).
            if (method == InviteMethod.Cancel && delivery.LastSentSequence < 0) continue;

            if (!delivery.ShouldSend(sequence, method)) continue;

            var message = new SessionInviteMessage(
                sync.ICalUid, sequence, method,
                new SessionInviteRecipient(r.EmployeeId, r.Email!, r.Name),
                _email.FromEmail, _email.FromName,
                title, session.StartUtc, session.EndUtc, location, description);

            await _sync.SendAsync(message, cancellationToken); // throws → outbox retries
            delivery.RecordSent(sequence, method);
            await _db.SaveChangesAsync(cancellationToken);     // persist this delivery before the next send
        }

        row.MarkProcessed();
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<RecipientRow>> ResolveRecipientsAsync(CalendarSyncOutbox row, CancellationToken cancellationToken)
    {
        // Attendee-specific event → just that learner (email from any enrollment, incl. a cancelled one).
        if (row.EmployeeId is { } employeeId)
        {
            var one = await _db.SessionEnrollments
                .AsNoTracking()
                .Where(x => x.SessionId == row.SessionId && x.EmployeeId == employeeId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new { x.EmployeeId, x.EmployeeEmail, x.EmployeeName })
                .FirstOrDefaultAsync(cancellationToken);

            return one is null
                ? new List<RecipientRow>()
                : new List<RecipientRow> { new(one.EmployeeId, one.EmployeeEmail, one.EmployeeName) };
        }

        // Session-wide event → all confirmed attendees.
        var rows = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(x => x.SessionId == row.SessionId
                        && (x.Status == EnrollmentStatus.Enrolled || x.Status == EnrollmentStatus.Attended))
            .Select(x => new { x.EmployeeId, x.EmployeeEmail, x.EmployeeName })
            .ToListAsync(cancellationToken);

        return rows.Select(x => new RecipientRow(x.EmployeeId, x.EmployeeEmail, x.EmployeeName)).ToList();
    }

    private sealed record RecipientRow(Guid EmployeeId, string? Email, string? Name);
}
