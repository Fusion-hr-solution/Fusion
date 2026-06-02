using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAttendanceTrendQueryHandler
    : IQueryHandler<GetAttendanceTrendQuery, Result<AttendanceTrendDto>>
{
    private readonly TrainingDbContext _db;

    public GetAttendanceTrendQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AttendanceTrendDto>> Handle(
        GetAttendanceTrendQuery request, CancellationToken cancellationToken)
    {
        // Default the window to the last 12 months when no explicit range is supplied (decision Q5).
        var filter = request.Filter with
        {
            From = request.Filter.From ?? DateTime.UtcNow.AddMonths(-12)
        };

        var facts = await AttendanceFactLoader.LoadAsync(
            _db, filter, DateTime.UtcNow, cancellationToken);

        var points = facts
            .Where(f => f.IsClosed)
            .GroupBy(f => new { f.StartUtc.Year, f.StartUtc.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g =>
            {
                var present = g.Count(f => f.IsPresent);
                var counted = g.Count();
                return new AttendanceTrendPointDto
                {
                    Year = g.Key.Year,
                    Month = g.Key.Month,
                    Label = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yyyy"),
                    PresentCount = present,
                    CountedTotal = counted,
                    AttendanceRate = AttendanceFactLoader.Rate(present, counted)
                };
            })
            .ToList();

        return Result.Success(new AttendanceTrendDto { Points = points });
    }
}
