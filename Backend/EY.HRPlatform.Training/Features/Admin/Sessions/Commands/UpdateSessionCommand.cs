using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
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
    string? TrainerEmail) : ICommand<Result<UpdateSessionResult>>;

public record UpdateSessionResult(List<RoomConflictItem> RoomConflicts);

public class UpdateSessionCommandHandler : ICommandHandler<UpdateSessionCommand, Result<UpdateSessionResult>>
{
    private readonly TrainingDbContext _db;

    public UpdateSessionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<UpdateSessionResult>> Handle(UpdateSessionCommand request, CancellationToken cancellationToken)
    {
        if (request.EndUtc <= request.StartUtc)
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.InvalidTimeRange", "End time must be after start time."));

        if (request.MaxCapacity <= 0)
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.InvalidCapacity", "Capacity must be greater than zero."));

        if (string.IsNullOrWhiteSpace(request.Room))
            return Result.Failure<UpdateSessionResult>(
                Error.Validation("Session.RoomRequired", "Room is required."));

        var session = await _db.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure<UpdateSessionResult>(Error.NotFound("TrainingSession", request.SessionId));

        session.Update(
            DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(request.EndUtc, DateTimeKind.Utc),
            request.Room.Trim(),
            request.MaxCapacity,
            request.Notes,
            request.TrainerEmployeeId,
            request.TrainerName?.Trim(),
            request.TrainerEmail?.Trim());

        await _db.SaveChangesAsync(cancellationToken);

        var conflicts = await RoomConflictDetector.DetectAsync(
            _db, session.Room, session.StartUtc, session.EndUtc, session.Id, cancellationToken);

        return Result.Success(new UpdateSessionResult(conflicts));
    }
}
