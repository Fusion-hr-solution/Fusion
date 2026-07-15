using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Queries;

/// <summary>
/// Admin planning calendar: all Sessions overlapping [FromUtc, ToUtc) with direct filters
/// (room / status / trainer) plus an audience filter — ServiceLine / Grade select Sessions whose
/// Training is mapped to that service line / grade in the CurriculumMapping matrix (who the
/// training is <i>for</i>), independent of who is enrolled.
/// </summary>
public record GetAdminPlanningQuery(
    DateTime FromUtc,
    DateTime ToUtc,
    Guid? ServiceLineId,
    Guid? GradeId,
    Guid? TrainerEmployeeId,
    string? Room,
    string? Status) : IQuery<Result<List<TrainingSessionListItemDto>>>;

public class GetAdminPlanningQueryHandler : IQueryHandler<GetAdminPlanningQuery, Result<List<TrainingSessionListItemDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAdminPlanningQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainingSessionListItemDto>>> Handle(GetAdminPlanningQuery request, CancellationToken cancellationToken)
    {
        // Npgsql requires Kind=Utc to compare against timestamptz; query-string bounds arrive as
        // Kind=Unspecified (mirrors DetectRoomConflictsQuery normalisation).
        var fromUtc = DateTime.SpecifyKind(request.FromUtc, DateTimeKind.Utc);
        var toUtc = DateTime.SpecifyKind(request.ToUtc, DateTimeKind.Utc);

        var query = _db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.StartUtc < toUtc && s.EndUtc > fromUtc);

        if (request.TrainerEmployeeId.HasValue)
            query = query.Where(s => s.TrainerEmployeeId == request.TrainerEmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(request.Room))
        {
            var roomLower = request.Room.Trim().ToLower();
            query = query.Where(s => s.Room.ToLower() == roomLower);
        }

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<SessionStatus>(request.Status, true, out var statusFilter))
        {
            query = query.Where(s => s.Status == statusFilter);
        }

        // Audience filter via CurriculumMapping: the Training must be mapped to the requested
        // service line / grade (intended audience), independent of who is enrolled.
        if (request.ServiceLineId.HasValue || request.GradeId.HasValue)
        {
            query = query.Where(s => _db.CurriculumMappings.Any(m =>
                m.TrainingId == s.Part.TrainingId &&
                (!request.ServiceLineId.HasValue || m.ServiceLineId == request.ServiceLineId.Value) &&
                (!request.GradeId.HasValue || m.GradeId == request.GradeId.Value)));
        }

        var rows = await query
            .OrderBy(s => s.StartUtc)
            .Select(s => new
            {
                s.Id,
                s.PartId,
                PartTitle = s.Part.Title,
                TrainingId = s.Part.TrainingId,
                TrainingTitle = s.Part.Training.Title,
                s.StartUtc,
                s.EndUtc,
                s.Room,
                s.MaxCapacity,
                s.TrainerName,
                s.TrainerEmployeeId,
                s.Status,
                EnrolledCount = _db.SessionEnrollments.Count(e =>
                    e.SessionId == s.Id &&
                    (e.Status == EnrollmentStatus.Enrolled || e.Status == EnrollmentStatus.Attended))
            })
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var dtos = rows.Select(s => new TrainingSessionListItemDto
        {
            Id = s.Id,
            PartId = s.PartId,
            PartTitle = s.PartTitle,
            TrainingId = s.TrainingId,
            TrainingTitle = s.TrainingTitle,
            StartUtc = s.StartUtc,
            EndUtc = s.EndUtc,
            Room = s.Room,
            MaxCapacity = s.MaxCapacity,
            EnrolledCount = s.EnrolledCount,
            TrainerName = s.TrainerName,
            TrainerEmployeeId = s.TrainerEmployeeId,
            Status = ProjectStatus(s.Status, s.StartUtc, s.EndUtc, nowUtc).ToString()
        }).ToList();

        return Result.Success(dtos);
    }

    private static SessionStatus ProjectStatus(SessionStatus persisted, DateTime startUtc, DateTime endUtc, DateTime nowUtc)
    {
        if (persisted is SessionStatus.Cancelled or SessionStatus.Completed) return persisted;
        if (nowUtc >= endUtc) return SessionStatus.Completed;
        if (nowUtc >= startUtc) return SessionStatus.InProgress;
        return SessionStatus.Planned;
    }
}
