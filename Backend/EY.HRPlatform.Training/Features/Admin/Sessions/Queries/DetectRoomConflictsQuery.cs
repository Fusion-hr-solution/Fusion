using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Queries;

public record DetectRoomConflictsQuery(
    string Room,
    DateTime StartUtc,
    DateTime EndUtc,
    Guid? ExcludeSessionId) : IQuery<Result<List<RoomConflictItem>>>;

public class DetectRoomConflictsQueryHandler : IQueryHandler<DetectRoomConflictsQuery, Result<List<RoomConflictItem>>>
{
    private readonly TrainingDbContext _db;

    public DetectRoomConflictsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<RoomConflictItem>>> Handle(DetectRoomConflictsQuery request, CancellationToken cancellationToken)
    {
        if (request.EndUtc <= request.StartUtc)
            return Result.Failure<List<RoomConflictItem>>(
                Error.Validation("Conflict.InvalidRange", "End time must be after start time."));

        var conflicts = await RoomConflictDetector.DetectAsync(
            _db,
            request.Room,
            DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(request.EndUtc, DateTimeKind.Utc),
            request.ExcludeSessionId,
            cancellationToken);

        return Result.Success(conflicts);
    }
}
