using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAttendanceSummaryQueryHandler
    : IQueryHandler<GetAttendanceSummaryQuery, Result<AttendanceSummaryDto>>
{
    private readonly TrainingDbContext _db;

    public GetAttendanceSummaryQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AttendanceSummaryDto>> Handle(
        GetAttendanceSummaryQuery request, CancellationToken cancellationToken)
    {
        var facts = await AttendanceFactLoader.LoadAsync(
            _db, request.Filter, DateTime.UtcNow, cancellationToken);

        var closed = facts.Where(f => f.IsClosed).ToList();

        var present = closed.Count(f => f.IsPresent);
        var absent = closed.Count - present;

        // Each closed session delivers its part's hours once, regardless of headcount.
        var deliveredHours = closed
            .GroupBy(f => f.SessionId)
            .Sum(g => g.First().Hours);

        return Result.Success(new AttendanceSummaryDto
        {
            OverallAttendanceRate = AttendanceFactLoader.Rate(present, present + absent),
            TotalSessions = closed.Select(f => f.SessionId).Distinct().Count(),
            TotalHoursDelivered = deliveredHours,
            TotalPresent = present,
            TotalAbsent = absent
        });
    }
}
