using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

public record AddSessionCommand(
    Guid TrainingId,
    Guid PartId,
    DateTime StartUtc,
    DateTime EndUtc,
    string Room,
    int MaxCapacity,
    string? Notes,
    Guid? TrainerEmployeeId,
    string? TrainerName,
    string? TrainerEmail) : ICommand<Result<AddSessionResult>>;

public record AddSessionResult(Guid SessionId, List<RoomConflictItem> RoomConflicts);

public class AddSessionCommandHandler : ICommandHandler<AddSessionCommand, Result<AddSessionResult>>
{
    private readonly TrainingDbContext _db;

    public AddSessionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AddSessionResult>> Handle(AddSessionCommand request, CancellationToken cancellationToken)
    {
        if (request.EndUtc <= request.StartUtc)
            return Result.Failure<AddSessionResult>(
                Error.Validation("Session.InvalidTimeRange", "End time must be after start time."));

        if (request.MaxCapacity <= 0)
            return Result.Failure<AddSessionResult>(
                Error.Validation("Session.InvalidCapacity", "Capacity must be greater than zero."));

        if (string.IsNullOrWhiteSpace(request.Room))
            return Result.Failure<AddSessionResult>(
                Error.Validation("Session.RoomRequired", "Room is required."));

        var part = await _db.TrainingParts
            .FirstOrDefaultAsync(p => p.Id == request.PartId && p.TrainingId == request.TrainingId, cancellationToken);

        if (part is null)
            return Result.Failure<AddSessionResult>(Error.NotFound("TrainingPart", request.PartId));

        var session = new TrainingSession(
            part.Id,
            DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(request.EndUtc, DateTimeKind.Utc),
            request.Room.Trim(),
            request.MaxCapacity,
            request.Notes,
            request.TrainerEmployeeId,
            request.TrainerName?.Trim(),
            request.TrainerEmail?.Trim());

        _db.TrainingSessions.Add(session);
        await _db.SaveChangesAsync(cancellationToken);

        var conflicts = await RoomConflictDetector.DetectAsync(
            _db, session.Room, session.StartUtc, session.EndUtc, session.Id, cancellationToken);

        return Result.Success(new AddSessionResult(session.Id, conflicts));
    }
}
