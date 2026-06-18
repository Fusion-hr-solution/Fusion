using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Features.Calendar.Conflicts;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Calendar.Queries;

/// <summary>Probe room + trainer conflicts for a candidate session window (warn, never block).</summary>
public record DetectScheduleConflictsQuery(
    string? Room,
    Guid? TrainerEmployeeId,
    string? TrainerEmail,
    DateTime StartUtc,
    DateTime EndUtc,
    Guid? ExcludeSessionId) : IQuery<Result<ScheduleConflictResultDto>>;

public class DetectScheduleConflictsQueryHandler
    : IQueryHandler<DetectScheduleConflictsQuery, Result<ScheduleConflictResultDto>>
{
    private readonly TrainingDbContext _db;

    public DetectScheduleConflictsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<ScheduleConflictResultDto>> Handle(DetectScheduleConflictsQuery request, CancellationToken cancellationToken)
    {
        // Npgsql requires Kind=Utc to compare against timestamptz columns (mirrors DetectRoomConflictsQuery).
        var startUtc = DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc);
        var endUtc = DateTime.SpecifyKind(request.EndUtc, DateTimeKind.Utc);

        if (endUtc <= startUtc)
            return Result.Failure<ScheduleConflictResultDto>(
                Error.Validation("Calendar.InvalidWindow", "End must be after start."));

        var result = await ScheduleConflictDetector.DetectAsync(
            _db,
            request.Room,
            request.TrainerEmployeeId,
            request.TrainerEmail,
            startUtc,
            endUtc,
            request.ExcludeSessionId,
            cancellationToken);

        return Result.Success(result);
    }
}
