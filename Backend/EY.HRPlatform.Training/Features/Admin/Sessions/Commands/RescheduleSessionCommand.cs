using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

/// <summary>
/// Narrow reschedule (Start/End only) — the drag/drop entry point on the planning calendar. Shares
/// the outbox enqueue with the full edit (UpdateSessionCommand): a real time change re-invites every
/// confirmed attendee.
/// </summary>
public record RescheduleSessionCommand(Guid SessionId, DateTime StartUtc, DateTime EndUtc)
    : ICommand<Result<UpdateSessionResult>>;

public class RescheduleSessionCommandHandler : ICommandHandler<RescheduleSessionCommand, Result<UpdateSessionResult>>
{
    private readonly TrainingDbContext _db;

    public RescheduleSessionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<UpdateSessionResult>> Handle(RescheduleSessionCommand request, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure<UpdateSessionResult>(Error.NotFound("TrainingSession", request.SessionId));

        var effectiveStatus = session.EffectiveStatus(DateTime.UtcNow);
        if (effectiveStatus is SessionStatus.Completed or SessionStatus.Cancelled)
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.NotReschedulable", "Completed or cancelled sessions cannot be rescheduled."));

        var newStart = DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc);
        var newEnd = DateTime.SpecifyKind(request.EndUtc, DateTimeKind.Utc);
        if (newEnd <= newStart)
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.InvalidTimeRange", "End time must be after start time."));

        var changed = session.StartUtc != newStart || session.EndUtc != newEnd;

        session.Update(
            newStart,
            newEnd,
            session.Room,
            session.MaxCapacity,
            session.Notes,
            session.TrainerEmployeeId,
            session.TrainerName,
            session.TrainerEmail);

        if (changed)
            _db.CalendarSyncOutboxes.Add(new CalendarSyncOutbox(CalendarSyncType.SessionRescheduled, session.Id));

        await _db.SaveChangesAsync(cancellationToken);

        var conflicts = await RoomConflictDetector.DetectAsync(
            _db, session.Room, session.StartUtc, session.EndUtc, session.Id, cancellationToken);

        return Result.Success(new UpdateSessionResult(conflicts));
    }
}
