using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Commands;

public record DuplicateSessionCommand(
    Guid SessionId,
    DateTime NewStartUtc,
    int Occurrences,
    int IntervalDays) : ICommand<Result<DuplicateSessionResult>>;

public record DuplicateSessionResult(List<Guid> CreatedSessionIds, List<RoomConflictItem> RoomConflicts);

public class DuplicateSessionCommandHandler : ICommandHandler<DuplicateSessionCommand, Result<DuplicateSessionResult>>
{
    private readonly TrainingDbContext _db;

    public DuplicateSessionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<DuplicateSessionResult>> Handle(DuplicateSessionCommand request, CancellationToken cancellationToken)
    {
        if (request.Occurrences < 1)
            return Result.Failure<DuplicateSessionResult>(
                Error.Validation("Session.InvalidOccurrences", "Occurrences must be at least 1."));

        if (request.IntervalDays < 1)
            return Result.Failure<DuplicateSessionResult>(
                Error.Validation("Session.InvalidInterval", "IntervalDays must be at least 1."));

        var source = await _db.TrainingSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (source is null)
            return Result.Failure<DuplicateSessionResult>(Error.NotFound("TrainingSession", request.SessionId));

        var duration = source.EndUtc - source.StartUtc;
        var createdIds = new List<Guid>();
        var allConflicts = new List<RoomConflictItem>();

        for (var i = 0; i < request.Occurrences; i++)
        {
            var start = DateTime.SpecifyKind(request.NewStartUtc.AddDays(request.IntervalDays * i), DateTimeKind.Utc);
            var end = start.Add(duration);

            var copy = new TrainingSession(
                source.PartId,
                start,
                end,
                source.Room,
                source.MaxCapacity,
                source.Notes,
                source.TrainerEmployeeId,
                source.TrainerName,
                source.TrainerEmail);

            _db.TrainingSessions.Add(copy);
            createdIds.Add(copy.Id);
        }

        await _db.SaveChangesAsync(cancellationToken);

        foreach (var id in createdIds)
        {
            var newSession = await _db.TrainingSessions.FindAsync([id], cancellationToken);
            if (newSession is null) continue;
            var conflicts = await RoomConflictDetector.DetectAsync(
                _db, newSession.Room, newSession.StartUtc, newSession.EndUtc, newSession.Id, cancellationToken);
            allConflicts.AddRange(conflicts);
        }

        return Result.Success(new DuplicateSessionResult(createdIds, allConflicts));
    }
}
