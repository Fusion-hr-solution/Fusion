using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Queries;

public record GetAvailableSessionsForEnrollmentQuery(
    Guid EmployeeId,
    Guid TrainingId) : IQuery<Result<AvailableSessionsForEnrollmentDto>>;

public class GetAvailableSessionsForEnrollmentQueryHandler
    : IQueryHandler<GetAvailableSessionsForEnrollmentQuery, Result<AvailableSessionsForEnrollmentDto>>
{
    private readonly TrainingDbContext _db;

    public GetAvailableSessionsForEnrollmentQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<AvailableSessionsForEnrollmentDto>> Handle(
        GetAvailableSessionsForEnrollmentQuery request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure<AvailableSessionsForEnrollmentDto>(Error.NotFound("Training", request.TrainingId));

        if (training.TrainingType != TrainingType.OnSite)
            return Result.Failure<AvailableSessionsForEnrollmentDto>(
                Error.Validation("Enrollment.NotOnSite", "Session enrollment is only available for on-site trainings."));

        var nowUtc = DateTime.UtcNow;

        var parts = await _db.TrainingParts
            .AsNoTracking()
            .Where(p => p.TrainingId == request.TrainingId)
            .OrderBy(p => p.OrderIndex)
            .ToListAsync(cancellationToken);

        var partIds = parts.Select(p => p.Id).ToList();

        var sessions = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => partIds.Contains(s.PartId))
            .ToListAsync(cancellationToken);

        // Get enrollment counts per session
        var sessionIds = sessions.Select(s => s.Id).ToList();
        var enrollmentCounts = await _db.SessionEnrollments
            .Where(e => sessionIds.Contains(e.SessionId) && e.Status == EnrollmentStatus.Enrolled)
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var countMap = enrollmentCounts.ToDictionary(x => x.SessionId, x => x.Count);

        var partsDto = parts.Select(part =>
        {
            var partSessions = sessions
                .Where(s => s.PartId == part.Id)
                .Where(s =>
                {
                    var effective = s.EffectiveStatus(nowUtc);
                    // Hide cancelled and completed sessions
                    return effective is not (SessionStatus.Cancelled or SessionStatus.Completed);
                })
                .OrderBy(s => s.StartUtc)
                .Select(s =>
                {
                    var enrolled = countMap.GetValueOrDefault(s.Id, 0);
                    var available = Math.Max(0, s.MaxCapacity - enrolled);
                    return new AvailableSessionDto
                    {
                        SessionId = s.Id,
                        StartUtc = s.StartUtc,
                        EndUtc = s.EndUtc,
                        Room = s.Room,
                        TrainerName = s.TrainerName,
                        TrainerEmail = s.TrainerEmail,
                        MaxCapacity = s.MaxCapacity,
                        EnrolledCount = enrolled,
                        AvailableSpots = available,
                        IsFull = available == 0,
                        Status = s.EffectiveStatus(nowUtc).ToString()
                    };
                })
                .ToList();

            return new PartWithSessionsDto
            {
                PartId = part.Id,
                Title = part.Title,
                Description = part.Description,
                OrderIndex = part.OrderIndex,
                DurationHours = part.DurationHours,
                Sessions = partSessions
            };
        }).ToList();

        return Result.Success(new AvailableSessionsForEnrollmentDto
        {
            TrainingId = request.TrainingId,
            TrainingTitle = training.Title,
            Parts = partsDto
        });
    }
}
