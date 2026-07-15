using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>US-8.2.1 — attendance report, one row per employee (enrolled / attended / missed / rate).</summary>
public record GetAttendanceByEmployeeQuery(AttendanceFilter Filter)
    : IQuery<Result<List<AttendanceByEmployeeRowDto>>>;

public class GetAttendanceByEmployeeQueryHandler
    : IQueryHandler<GetAttendanceByEmployeeQuery, Result<List<AttendanceByEmployeeRowDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAttendanceByEmployeeQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<AttendanceByEmployeeRowDto>>> Handle(
        GetAttendanceByEmployeeQuery request, CancellationToken cancellationToken)
    {
        var facts = await AttendanceFactLoader.LoadAsync(
            _db, request.Filter, DateTime.UtcNow, cancellationToken);

        if (facts.Count == 0)
            return Result.Success(new List<AttendanceByEmployeeRowDto>());

        var employeeIds = facts.Select(f => f.EmployeeId).Distinct().ToList();

        var profiles = await _db.EmployeeProfiles
            .AsNoTracking()
            .Where(ep => employeeIds.Contains(ep.EmployeeId))
            .Select(ep => new { ep.EmployeeId, ep.FullName, ep.Email })
            .ToListAsync(cancellationToken);
        var profileLookup = profiles
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        var gradeNames = await _db.Grades.AsNoTracking()
            .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);
        var serviceLineNames = await _db.ServiceLines.AsNoTracking()
            .ToDictionaryAsync(s => s.Id, s => s.Name, cancellationToken);

        var rows = facts
            .GroupBy(f => f.EmployeeId)
            .Select(g =>
            {
                var attended = g.Count(f => f.IsPresent);
                var missed = g.Count(f => f.IsClosed && !f.IsPresent);
                profileLookup.TryGetValue(g.Key, out var profile);
                var first = g.First();
                return new AttendanceByEmployeeRowDto
                {
                    EmployeeId = g.Key,
                    EmployeeName = profile?.FullName,
                    Email = profile?.Email,
                    GradeName = first.GradeId is { } gid ? gradeNames.GetValueOrDefault(gid, "Unassigned") : "Unassigned",
                    ServiceLineName = first.ServiceLineId is { } sid ? serviceLineNames.GetValueOrDefault(sid, "Unassigned") : "Unassigned",
                    SessionsEnrolled = g.Count(),
                    Attended = attended,
                    Missed = missed,
                    AttendanceRate = AttendanceFactLoader.Rate(attended, attended + missed),
                };
            })
            .OrderBy(r => r.EmployeeName ?? "￿")
            .ToList();

        return Result.Success(rows);
    }
}
