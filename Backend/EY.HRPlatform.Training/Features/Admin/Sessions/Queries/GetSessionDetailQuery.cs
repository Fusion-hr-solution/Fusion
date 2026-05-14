using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Queries;

public record GetSessionDetailQuery(Guid SessionId) : IQuery<Result<TrainingSessionDetailDto>>;

public class GetSessionDetailQueryHandler : IQueryHandler<GetSessionDetailQuery, Result<TrainingSessionDetailDto>>
{
    private readonly TrainingDbContext _db;

    public GetSessionDetailQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainingSessionDetailDto>> Handle(GetSessionDetailQuery request, CancellationToken cancellationToken)
    {
        var s = await _db.TrainingSessions
            .AsNoTracking()
            .Where(x => x.Id == request.SessionId)
            .Select(x => new TrainingSessionDetailDto
            {
                Id = x.Id,
                PartId = x.PartId,
                PartTitle = x.Part.Title,
                TrainingId = x.Part.TrainingId,
                TrainingTitle = x.Part.Training.Title,
                StartUtc = x.StartUtc,
                EndUtc = x.EndUtc,
                Room = x.Room,
                MaxCapacity = x.MaxCapacity,
                EnrolledCount = _db.SessionEnrollments.Count(e =>
                    e.SessionId == x.Id &&
                    (e.Status == EnrollmentStatus.Enrolled || e.Status == EnrollmentStatus.Attended)),
                Notes = x.Notes,
                TrainerEmployeeId = x.TrainerEmployeeId,
                TrainerName = x.TrainerName,
                TrainerEmail = x.TrainerEmail,
                Status = x.Status.ToString(),
                CancelReason = x.CancelReason,
                CancelledAt = x.CancelledAt,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (s is null)
            return Result.Failure<TrainingSessionDetailDto>(Error.NotFound("TrainingSession", request.SessionId));

        s.Attendees = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.SessionId == request.SessionId &&
                (e.Status == EnrollmentStatus.Enrolled || e.Status == EnrollmentStatus.Attended))
            .Select(e => new SessionAttendeeDto
            {
                EmployeeId = e.EmployeeId,
                FullName = e.EmployeeName,
                Email = e.EmployeeEmail,
            })
            .ToListAsync(cancellationToken);

        return Result.Success(s);
    }
}
