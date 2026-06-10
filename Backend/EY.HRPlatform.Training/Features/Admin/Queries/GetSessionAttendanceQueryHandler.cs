using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetSessionAttendanceQueryHandler
    : IQueryHandler<GetSessionAttendanceQuery, Result<SessionAttendanceDto>>
{
    private readonly TrainingDbContext _db;

    public GetSessionAttendanceQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<SessionAttendanceDto>> Handle(
        GetSessionAttendanceQuery request, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingSessions
            .AsNoTracking()
            .Include(s => s.Part).ThenInclude(p => p.Training)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure<SessionAttendanceDto>(
                Error.NotFound("TrainingSession", request.SessionId));

        var enrollments = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.SessionId == request.SessionId
                && e.Status != EnrollmentStatus.Cancelled
                && e.Status != EnrollmentStatus.Waitlisted)
            .Select(e => new
            {
                e.EmployeeId,
                e.EmployeeName,
                e.EmployeeEmail,
                IsAttended = e.Status == EnrollmentStatus.Attended
            })
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var isClosed = session.Status == SessionStatus.Completed || nowUtc >= session.EndUtc;

        var attendees = enrollments
            .Select(e => new SessionAttendanceAttendeeDto
            {
                EmployeeId = e.EmployeeId,
                EmployeeName = e.EmployeeName,
                EmployeeEmail = e.EmployeeEmail,
                Status = e.IsAttended ? "present" : isClosed ? "absent" : "pending"
            })
            .OrderBy(a => a.EmployeeName)
            .ToList();

        var present = attendees.Count(a => a.Status == "present");
        var absent = attendees.Count(a => a.Status == "absent");
        var pending = attendees.Count(a => a.Status == "pending");
        var counted = present + absent;

        return Result.Success(new SessionAttendanceDto
        {
            SessionId = session.Id,
            TrainingTitle = session.Part.Training.Title,
            PartTitle = session.Part.Title,
            StartUtc = session.StartUtc,
            EndUtc = session.EndUtc,
            IsClosed = isClosed,
            PresentCount = present,
            AbsentCount = absent,
            PendingCount = pending,
            CountedTotal = counted,
            AttendanceRate = AttendanceFactLoader.Rate(present, counted),
            Attendees = attendees
        });
    }
}
