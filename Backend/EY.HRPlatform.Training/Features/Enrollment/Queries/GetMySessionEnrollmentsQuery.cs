using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Queries;

public record GetMySessionEnrollmentsQuery(
    Guid EmployeeId,
    Guid TrainingId) : IQuery<Result<MySessionEnrollmentsDto>>;

public class GetMySessionEnrollmentsQueryHandler
    : IQueryHandler<GetMySessionEnrollmentsQuery, Result<MySessionEnrollmentsDto>>
{
    private readonly TrainingDbContext _db;

    public GetMySessionEnrollmentsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<MySessionEnrollmentsDto>> Handle(
        GetMySessionEnrollmentsQuery request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure<MySessionEnrollmentsDto>(Error.NotFound("Training", request.TrainingId));

        var parts = await _db.TrainingParts
            .AsNoTracking()
            .Where(p => p.TrainingId == request.TrainingId)
            .OrderBy(p => p.OrderIndex)
            .ToListAsync(cancellationToken);

        var partIds = parts.Select(p => p.Id).ToList();

        // Get all sessions for these parts
        var sessions = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => partIds.Contains(s.PartId))
            .ToListAsync(cancellationToken);

        var sessionIds = sessions.Select(s => s.Id).ToList();

        // Get employee's enrollments
        var enrollments = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.EmployeeId == request.EmployeeId
                && sessionIds.Contains(e.SessionId)
                && e.Status != EnrollmentStatus.Cancelled)
            .ToListAsync(cancellationToken);

        var partEnrollments = parts.Select(part =>
        {
            var partSessionIds = sessions.Where(s => s.PartId == part.Id).Select(s => s.Id).ToHashSet();
            var enrollment = enrollments.FirstOrDefault(e => partSessionIds.Contains(e.SessionId));
            var session = enrollment != null ? sessions.FirstOrDefault(s => s.Id == enrollment.SessionId) : null;

            return new MyPartEnrollmentDto
            {
                PartId = part.Id,
                PartTitle = part.Title,
                OrderIndex = part.OrderIndex,
                SessionId = session?.Id,
                SessionStartUtc = session?.StartUtc,
                SessionEndUtc = session?.EndUtc,
                Room = session?.Room,
                TrainerName = session?.TrainerName,
                EnrollmentStatus = enrollment?.Status.ToString() ?? "NotEnrolled",
                IsAttended = enrollment?.Status == EnrollmentStatus.Attended
            };
        }).ToList();

        var completedParts = partEnrollments.Count(p => p.IsAttended);
        var totalParts = parts.Count;

        return Result.Success(new MySessionEnrollmentsDto
        {
            TrainingId = request.TrainingId,
            TrainingTitle = training.Title,
            TotalParts = totalParts,
            CompletedParts = completedParts,
            IsTrainingCompleted = completedParts == totalParts && totalParts > 0,
            Parts = partEnrollments
        });
    }
}
