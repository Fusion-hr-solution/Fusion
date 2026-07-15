using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Ics;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Queries;

/// <summary>Build a single-session .ics download ("Add to calendar"), scoped to the caller.</summary>
public record GetSessionIcsQuery(Guid SessionId, Guid EmployeeId, bool IsAdmin) : IQuery<Result<string>>;

public class GetSessionIcsQueryHandler : IQueryHandler<GetSessionIcsQuery, Result<string>>
{
    private readonly TrainingDbContext _db;
    private readonly ICalendarFeedService _feed;

    public GetSessionIcsQueryHandler(TrainingDbContext db, ICalendarFeedService feed)
    {
        _db = db;
        _feed = feed;
    }

    public async Task<Result<string>> Handle(GetSessionIcsQuery request, CancellationToken cancellationToken)
    {
        var row = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.Id == request.SessionId && s.Status != SessionStatus.Cancelled)
            .Select(s => new
            {
                s.Id,
                s.PartId,
                PartTitle = s.Part.Title,
                TrainingId = s.Part.TrainingId,
                TrainingTitle = s.Part.Training.Title,
                s.StartUtc,
                s.EndUtc,
                s.Room,
                s.TrainerName
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
            return Result.Failure<string>(Error.NotFound("TrainingSession", request.SessionId));

        // Object-level authorization: only an enrolled learner (or an admin) may download a
        // session's details. Use the same NotFound for "missing" and "not yours" — no existence oracle.
        if (!request.IsAdmin)
        {
            var enrolled = await _db.SessionEnrollments
                .AsNoTracking()
                .AnyAsync(e =>
                    e.SessionId == request.SessionId &&
                    e.EmployeeId == request.EmployeeId &&
                    e.Status != EnrollmentStatus.Cancelled,
                    cancellationToken);

            if (!enrolled)
                return Result.Failure<string>(Error.NotFound("TrainingSession", request.SessionId));
        }

        var dto = new CalendarEventDto
        {
            Id = row.Id,
            Kind = "session",
            Title = $"{row.TrainingTitle} — {row.PartTitle}",
            StartUtc = row.StartUtc,
            EndUtc = row.EndUtc,
            AllDay = false,
            TrainingId = row.TrainingId,
            PartId = row.PartId,
            Room = string.IsNullOrWhiteSpace(row.Room) ? null : row.Room,
            TrainerName = row.TrainerName
        };

        return Result.Success(_feed.Build(new[] { dto }, dto.Title));
    }
}
