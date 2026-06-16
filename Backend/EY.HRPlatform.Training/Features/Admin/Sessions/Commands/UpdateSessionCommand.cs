using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Budget;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

public record UpdateSessionCommand(
    Guid SessionId,
    DateTime StartUtc,
    DateTime EndUtc,
    string Room,
    int MaxCapacity,
    string? Notes,
    Guid? TrainerEmployeeId,
    string? TrainerName,
    string? TrainerEmail,
    decimal? ExternalTrainerCost = null,
    decimal? VenueCost = null,
    decimal? MaterialsCost = null,
    decimal? OtherCost = null) : ICommand<Result<UpdateSessionResult>>;

public record UpdateSessionResult(List<RoomConflictItem> RoomConflicts);

public class UpdateSessionCommandHandler : ICommandHandler<UpdateSessionCommand, Result<UpdateSessionResult>>
{
    private readonly TrainingDbContext _db;
    private readonly IBudgetAlertNotifier _notifier;

    public UpdateSessionCommandHandler(TrainingDbContext db, IBudgetAlertNotifier notifier)
    {
        _db = db;
        _notifier = notifier;
    }

    public async Task<Result<UpdateSessionResult>> Handle(UpdateSessionCommand request, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure<UpdateSessionResult>(Error.NotFound("TrainingSession", request.SessionId));

        // Capture the pre-update cost total for budget threshold-crossing detection.
        var oldTotal = (session.ExternalTrainerCost ?? 0m) + (session.VenueCost ?? 0m)
                     + (session.MaterialsCost ?? 0m) + (session.OtherCost ?? 0m);

        var nowUtc = DateTime.UtcNow;
        var effectiveStatus = session.EffectiveStatus(nowUtc);

        // Completed sessions are locked — only trainer info and notes can be updated
        if (effectiveStatus == SessionStatus.Completed)
        {
            session.UpdateTrainerAndNotes(
                request.Notes,
                request.TrainerEmployeeId,
                request.TrainerName?.Trim(),
                request.TrainerEmail?.Trim());

            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(new UpdateSessionResult(new List<RoomConflictItem>()));
        }

        if (request.EndUtc <= request.StartUtc)
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.InvalidTimeRange", "End time must be after start time."));

        if (request.MaxCapacity <= 0)
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.InvalidCapacity", "Capacity must be greater than zero."));

        if (string.IsNullOrWhiteSpace(request.Room))
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.RoomRequired", "Room is required."));

        session.Update(
            DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(request.EndUtc, DateTimeKind.Utc),
            request.Room.Trim(),
            request.MaxCapacity,
            request.Notes,
            request.TrainerEmployeeId,
            request.TrainerName?.Trim(),
            request.TrainerEmail?.Trim(),
            request.ExternalTrainerCost,
            request.VenueCost,
            request.MaterialsCost,
            request.OtherCost);

        await _db.SaveChangesAsync(cancellationToken);

        // Budget threshold alert (best-effort) for the cost delta. The Completed branch above does
        // not change costs, so it intentionally skips this; cancellation lowers spend (handled elsewhere).
        var newTotal = (request.ExternalTrainerCost ?? 0m) + (request.VenueCost ?? 0m)
                     + (request.MaterialsCost ?? 0m) + (request.OtherCost ?? 0m);
        await _notifier.NotifyOnSessionCostChangeAsync(session.Id, oldTotal, newTotal, cancellationToken);

        var conflicts = await RoomConflictDetector.DetectAsync(
            _db, session.Room, session.StartUtc, session.EndUtc, session.Id, cancellationToken);

        return Result.Success(new UpdateSessionResult(conflicts));
    }
}
