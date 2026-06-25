using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

/// <summary>
/// Returns personal in-person training hours for the dashboard widget:
/// totals (year/quarter/month/all-time), session breakdown, and the
/// in-person vs e-learning hours ratio for the pie chart.
/// </summary>
public record GetMyInPersonHoursQuery(Guid EmployeeId) : IQuery<Result<MyInPersonHoursDto>>;

public class GetMyInPersonHoursQueryHandler
    : IQueryHandler<GetMyInPersonHoursQuery, Result<MyInPersonHoursDto>>
{
    private readonly TrainingDbContext _db;

    public GetMyInPersonHoursQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<MyInPersonHoursDto>> Handle(
        GetMyInPersonHoursQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var startOfYear = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var startOfQuarter = new DateTime(now.Year, ((now.Month - 1) / 3) * 3 + 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // Attended in-person sessions for this employee
        var attended = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.EmployeeId == request.EmployeeId && e.Status == EnrollmentStatus.Attended)
            .Select(e => new AttendedSessionItem
            {
                SessionId = e.SessionId,
                TrainingId = e.Session.Part.TrainingId,
                TrainingTitle = e.Session.Part.Training.Title,
                PartTitle = e.Session.Part.Title,
                StartUtc = e.Session.StartUtc,
                EndUtc = e.Session.EndUtc,
                Room = e.Session.Room,
            })
            .ToListAsync(cancellationToken);

        foreach (var item in attended)
        {
            item.Hours = Math.Round((item.EndUtc - item.StartUtc).TotalHours, 2);
        }

        // Order most-recent first
        attended = attended.OrderByDescending(a => a.StartUtc).ToList();

        var totalHoursAllTime = attended.Sum(a => a.Hours);
        var totalHoursYear = attended.Where(a => a.StartUtc >= startOfYear).Sum(a => a.Hours);
        var totalHoursQuarter = attended.Where(a => a.StartUtc >= startOfQuarter).Sum(a => a.Hours);
        var totalHoursMonth = attended.Where(a => a.StartUtc >= startOfMonth).Sum(a => a.Hours);

        // E-learning hours: authored content duration per completed e-learning training, with a
        // per-training 0.5h/chapter fallback. Shared with the admin hours report (US-8.2.1) via
        // ELearningHoursCalculator so the learner widget and the report always agree.
        var eHoursByTraining = await ELearningHoursCalculator.LoadAsync(_db, cancellationToken);
        var completedELearningTrainingIds = await _db.TrainingProgress
            .AsNoTracking()
            .Where(p => p.EmployeeId == request.EmployeeId
                        && p.Status == TrainingStatus.Completed
                        && p.Training.TrainingType == TrainingType.ELearning)
            .Select(p => p.TrainingId)
            .ToListAsync(cancellationToken);
        var eLearningHours = completedELearningTrainingIds.Sum(id => eHoursByTraining.GetValueOrDefault(id, 0));

        return Result.Success(new MyInPersonHoursDto
        {
            TotalHoursAllTime = Math.Round(totalHoursAllTime, 2),
            TotalHoursYear = Math.Round(totalHoursYear, 2),
            TotalHoursQuarter = Math.Round(totalHoursQuarter, 2),
            TotalHoursMonth = Math.Round(totalHoursMonth, 2),
            InPersonHours = Math.Round(totalHoursAllTime, 2),
            ELearningHours = Math.Round(eLearningHours, 2),
            AttendedSessions = attended,
        });
    }
}
