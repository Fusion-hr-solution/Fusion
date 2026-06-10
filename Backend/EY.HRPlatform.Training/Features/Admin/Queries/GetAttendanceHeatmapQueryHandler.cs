using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAttendanceHeatmapQueryHandler
    : IQueryHandler<GetAttendanceHeatmapQuery, Result<AttendanceHeatmapDto>>
{
    private readonly TrainingDbContext _db;

    public GetAttendanceHeatmapQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AttendanceHeatmapDto>> Handle(
        GetAttendanceHeatmapQuery request, CancellationToken cancellationToken)
    {
        var filter = request.Filter with
        {
            From = request.Filter.From ?? DateTime.UtcNow.AddMonths(-12)
        };

        var facts = await AttendanceFactLoader.LoadAsync(
            _db, filter, DateTime.UtcNow, cancellationToken);

        var grades = await _db.Grades
            .AsNoTracking()
            .OrderBy(g => g.Level)
            .Select(g => new GradeDto { Id = g.Id, Name = g.Name, Level = g.Level })
            .ToListAsync(cancellationToken);

        var closed = facts.Where(f => f.IsClosed).ToList();

        var hasUnassigned = closed.Any(f => f.GradeId is null);
        if (hasUnassigned)
            grades.Add(new GradeDto { Id = Guid.Empty, Name = "Unassigned", Level = int.MaxValue });

        // Distinct month columns ordered chronologically.
        var months = closed
            .Select(f => new { f.StartUtc.Year, f.StartUtc.Month })
            .Distinct()
            .OrderBy(m => m.Year).ThenBy(m => m.Month)
            .Select(m => new AttendanceHeatmapMonthDto
            {
                Year = m.Year,
                Month = m.Month,
                Label = new DateTime(m.Year, m.Month, 1).ToString("MMM yyyy")
            })
            .ToList();

        var cells = closed
            .GroupBy(f => new { f.GradeId, f.StartUtc.Year, f.StartUtc.Month })
            .Select(g =>
            {
                var present = g.Count(f => f.IsPresent);
                var counted = g.Count();
                return new AttendanceHeatmapCellDto
                {
                    GradeId = g.Key.GradeId,
                    Year = g.Key.Year,
                    Month = g.Key.Month,
                    PresentCount = present,
                    CountedTotal = counted,
                    AttendanceRate = AttendanceFactLoader.Rate(present, counted)
                };
            })
            .ToList();

        return Result.Success(new AttendanceHeatmapDto
        {
            Grades = grades,
            Months = months,
            Cells = cells
        });
    }
}
