using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAttendanceByGradeQueryHandler
    : IQueryHandler<GetAttendanceByGradeQuery, Result<List<AttendanceByGradeDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAttendanceByGradeQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<AttendanceByGradeDto>>> Handle(
        GetAttendanceByGradeQuery request, CancellationToken cancellationToken)
    {
        var facts = await AttendanceFactLoader.LoadAsync(
            _db, request.Filter, DateTime.UtcNow, cancellationToken);

        var grades = await _db.Grades
            .AsNoTracking()
            .OrderBy(g => g.Level)
            .Select(g => new { g.Id, g.Name, g.Level })
            .ToListAsync(cancellationToken);

        // Only closed sessions contribute to the rate (decision Q3).
        var closed = facts.Where(f => f.IsClosed).ToList();

        var result = new List<AttendanceByGradeDto>();

        foreach (var grade in grades)
        {
            var gradeFacts = closed.Where(f => f.GradeId == grade.Id).ToList();
            var present = gradeFacts.Count(f => f.IsPresent);
            var counted = gradeFacts.Count;
            result.Add(new AttendanceByGradeDto
            {
                GradeId = grade.Id,
                GradeName = grade.Name,
                Level = grade.Level,
                PresentCount = present,
                CountedTotal = counted,
                AttendanceRate = AttendanceFactLoader.Rate(present, counted)
            });
        }

        // Unassigned bucket (no grade profile) — only when there is data for it.
        var unassigned = closed.Where(f => f.GradeId is null).ToList();
        if (unassigned.Count > 0)
        {
            var present = unassigned.Count(f => f.IsPresent);
            result.Add(new AttendanceByGradeDto
            {
                GradeId = null,
                GradeName = "Unassigned",
                Level = int.MaxValue,
                PresentCount = present,
                CountedTotal = unassigned.Count,
                AttendanceRate = AttendanceFactLoader.Rate(present, unassigned.Count)
            });
        }

        return Result.Success(result);
    }
}
