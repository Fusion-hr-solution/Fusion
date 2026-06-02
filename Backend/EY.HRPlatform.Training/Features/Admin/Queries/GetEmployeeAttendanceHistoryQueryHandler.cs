using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetEmployeeAttendanceHistoryQueryHandler
    : IQueryHandler<GetEmployeeAttendanceHistoryQuery, Result<EmployeeAttendanceHistoryDto>>
{
    private readonly TrainingDbContext _db;

    public GetEmployeeAttendanceHistoryQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<EmployeeAttendanceHistoryDto>> Handle(
        GetEmployeeAttendanceHistoryQuery request, CancellationToken cancellationToken)
    {
        var query = _db.SessionEnrollments
            .AsNoTracking()
            .Include(e => e.Session).ThenInclude(s => s.Part).ThenInclude(p => p.Training)
            .Where(e => e.EmployeeId == request.EmployeeId
                && e.Status != EnrollmentStatus.Cancelled
                && e.Status != EnrollmentStatus.Waitlisted
                && e.Session.Status != SessionStatus.Cancelled);

        if (request.From.HasValue)
            query = query.Where(e => e.Session.StartUtc >= request.From.Value);
        if (request.To.HasValue)
            query = query.Where(e => e.Session.StartUtc <= request.To.Value);

        var rows = await query
            .Select(e => new
            {
                e.SessionId,
                e.EmployeeName,
                TrainingTitle = e.Session.Part.Training.Title,
                PartTitle = e.Session.Part.Title,
                e.Session.StartUtc,
                e.Session.EndUtc,
                SessionStatus = e.Session.Status,
                Hours = e.Session.Part.DurationHours,
                IsAttended = e.Status == EnrollmentStatus.Attended
            })
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;

        var records = rows
            .OrderByDescending(r => r.StartUtc)
            .Select(r =>
            {
                var isClosed = r.SessionStatus == SessionStatus.Completed || nowUtc >= r.EndUtc;
                return new EmployeeAttendanceRecordDto
                {
                    SessionId = r.SessionId,
                    TrainingTitle = r.TrainingTitle,
                    PartTitle = r.PartTitle,
                    SessionDate = r.StartUtc,
                    Status = r.IsAttended ? "present" : isClosed ? "absent" : "pending",
                    Hours = r.Hours
                };
            })
            .ToList();

        var present = records.Count(r => r.Status == "present");
        var absent = records.Count(r => r.Status == "absent");
        var totalHours = rows.Where(r => r.IsAttended).Sum(r => r.Hours);

        return Result.Success(new EmployeeAttendanceHistoryDto
        {
            EmployeeId = request.EmployeeId,
            EmployeeName = rows.Select(r => r.EmployeeName).FirstOrDefault(n => n != null),
            OverallAttendanceRate = AttendanceFactLoader.Rate(present, present + absent),
            TotalInPersonHours = totalHours,
            PresentCount = present,
            AbsentCount = absent,
            Records = records
        });
    }
}
