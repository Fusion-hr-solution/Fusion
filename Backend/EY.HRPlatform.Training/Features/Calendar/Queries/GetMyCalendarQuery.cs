using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Queries;

/// <summary>The signed-in learner's calendar in [FromUtc, ToUtc): enrolled Sessions + Deadline markers.</summary>
public record GetMyCalendarQuery(Guid EmployeeId, DateTime FromUtc, DateTime ToUtc)
    : IQuery<Result<List<CalendarEventDto>>>;

public class GetMyCalendarQueryHandler : IQueryHandler<GetMyCalendarQuery, Result<List<CalendarEventDto>>>
{
    private readonly TrainingDbContext _db;

    public GetMyCalendarQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<CalendarEventDto>>> Handle(GetMyCalendarQuery request, CancellationToken cancellationToken)
    {
        // Window bounds can arrive as Kind=Unspecified from query-string binding; Npgsql requires
        // Kind=Utc to compare against timestamptz columns (mirrors DetectRoomConflictsQuery).
        var fromUtc = DateTime.SpecifyKind(request.FromUtc, DateTimeKind.Utc);
        var toUtc = DateTime.SpecifyKind(request.ToUtc, DateTimeKind.Utc);

        // Timed events: the learner's own non-cancelled enrollments on non-cancelled sessions
        // whose [Start, End) overlaps the window.
        var sessions = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(e =>
                e.EmployeeId == request.EmployeeId &&
                e.Status != EnrollmentStatus.Cancelled &&
                e.Session.Status != SessionStatus.Cancelled &&
                e.Session.StartUtc < toUtc &&
                e.Session.EndUtc > fromUtc)
            .Select(e => new
            {
                e.SessionId,
                EnrollmentStatus = e.Status,
                e.Session.StartUtc,
                e.Session.EndUtc,
                e.Session.Room,
                e.Session.TrainerName,
                PersistedStatus = e.Session.Status,
                e.Session.PartId,
                PartTitle = e.Session.Part.Title,
                TrainingId = e.Session.Part.TrainingId,
                TrainingTitle = e.Session.Part.Training.Title
            })
            .ToListAsync(cancellationToken);

        // All-day markers: the learner's assignment due dates that fall in the window.
        var deadlines = await _db.Assignments
            .AsNoTracking()
            .Where(a =>
                a.EmployeeId == request.EmployeeId &&
                a.DueDate != null &&
                a.DueDate >= fromUtc &&
                a.DueDate <= toUtc)
            .Select(a => new
            {
                AssignmentId = a.Id,
                a.TrainingId,
                TrainingTitle = a.Training.Title,
                DueDate = a.DueDate!.Value
            })
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;

        var events = sessions.Select(s => new CalendarEventDto
        {
            Id = s.SessionId,
            Kind = "session",
            Title = $"{s.TrainingTitle} — {s.PartTitle}",
            StartUtc = s.StartUtc,
            EndUtc = s.EndUtc,
            AllDay = false,
            TrainingId = s.TrainingId,
            PartId = s.PartId,
            Room = string.IsNullOrWhiteSpace(s.Room) ? null : s.Room,
            TrainerName = s.TrainerName,
            SessionStatus = ProjectStatus(s.PersistedStatus, s.StartUtc, s.EndUtc, nowUtc).ToString(),
            EnrollmentStatus = s.EnrollmentStatus.ToString(),
            IsWaitlisted = s.EnrollmentStatus == EnrollmentStatus.Waitlisted
        }).ToList();

        events.AddRange(deadlines.Select(d => new CalendarEventDto
        {
            Id = d.AssignmentId,
            Kind = "deadline",
            Title = $"Due: {d.TrainingTitle}",
            StartUtc = d.DueDate,
            EndUtc = d.DueDate,
            AllDay = true,
            TrainingId = d.TrainingId,
            PartId = null,
            Room = null,
            TrainerName = null,
            SessionStatus = null,
            EnrollmentStatus = null,
            IsWaitlisted = false
        }));

        return Result.Success(events.OrderBy(e => e.StartUtc).ToList());
    }

    private static SessionStatus ProjectStatus(SessionStatus persisted, DateTime startUtc, DateTime endUtc, DateTime nowUtc)
    {
        if (persisted is SessionStatus.Cancelled or SessionStatus.Completed) return persisted;
        if (nowUtc >= endUtc) return SessionStatus.Completed;
        if (nowUtc >= startUtc) return SessionStatus.InProgress;
        return SessionStatus.Planned;
    }
}
