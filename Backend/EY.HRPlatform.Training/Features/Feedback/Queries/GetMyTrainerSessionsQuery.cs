using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Queries;

/// <summary>US-8.1.3 — sessions the current employee leads as trainer (for trainer-to-group feedback).</summary>
public record GetMyTrainerSessionsQuery(Guid EmployeeId) : IQuery<Result<List<TrainerSessionDto>>>;

public class GetMyTrainerSessionsQueryHandler
    : IQueryHandler<GetMyTrainerSessionsQuery, Result<List<TrainerSessionDto>>>
{
    private readonly TrainingDbContext _db;

    public GetMyTrainerSessionsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainerSessionDto>>> Handle(
        GetMyTrainerSessionsQuery request, CancellationToken cancellationToken)
    {
        var sessions = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.TrainerEmployeeId == request.EmployeeId && s.Status != SessionStatus.Cancelled)
            .Select(s => new
            {
                s.Id,
                s.StartUtc,
                s.EndUtc,
                s.Room,
                s.Status,
                PartTitle = s.Part.Title,
                TrainingTitle = s.Part.Training.Title,
            })
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0)
            return Result.Success(new List<TrainerSessionDto>());

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var withFeedback = (await _db.TrainerGroupFeedbacks
                .AsNoTracking()
                .Where(t => t.TrainerEmployeeId == request.EmployeeId && sessionIds.Contains(t.SessionId))
                .Select(t => t.SessionId)
                .ToListAsync(cancellationToken))
            .ToHashSet();

        var nowUtc = DateTime.UtcNow;

        var result = sessions
            .Select(s => new TrainerSessionDto
            {
                SessionId = s.Id,
                TrainingTitle = s.TrainingTitle,
                PartTitle = s.PartTitle,
                StartUtc = s.StartUtc,
                EndUtc = s.EndUtc,
                Room = s.Room,
                Status = EffectiveStatus(s.Status, s.StartUtc, s.EndUtc, nowUtc),
                HasGroupFeedback = withFeedback.Contains(s.Id),
            })
            .OrderByDescending(s => s.StartUtc)
            .ToList();

        return Result.Success(result);
    }

    private static string EffectiveStatus(SessionStatus status, DateTime startUtc, DateTime endUtc, DateTime nowUtc)
    {
        if (status == SessionStatus.Completed) return nameof(SessionStatus.Completed);
        if (nowUtc >= endUtc) return nameof(SessionStatus.Completed);
        if (nowUtc >= startUtc) return nameof(SessionStatus.InProgress);
        return nameof(SessionStatus.Planned);
    }
}
