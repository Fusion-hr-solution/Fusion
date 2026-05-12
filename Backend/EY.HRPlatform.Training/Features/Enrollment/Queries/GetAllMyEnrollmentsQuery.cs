using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Queries;

public record GetAllMyEnrollmentsQuery(Guid EmployeeId) : IQuery<Result<List<MyEnrollmentSummaryDto>>>;

public class GetAllMyEnrollmentsQueryHandler
    : IQueryHandler<GetAllMyEnrollmentsQuery, Result<List<MyEnrollmentSummaryDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAllMyEnrollmentsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<MyEnrollmentSummaryDto>>> Handle(
        GetAllMyEnrollmentsQuery request, CancellationToken cancellationToken)
    {
        var enrollments = await _db.SessionEnrollments
            .AsNoTracking()
            .Where(e => e.EmployeeId == request.EmployeeId && e.Status != EnrollmentStatus.Cancelled)
            .Select(e => new
            {
                e.Id,
                e.SessionId,
                e.Status,
                e.WaitlistPosition,
                e.CreatedAt,
                SessionStartUtc = e.Session.StartUtc,
                SessionEndUtc = e.Session.EndUtc,
                Room = e.Session.Room,
                TrainerName = e.Session.TrainerName,
                TrainerEmail = e.Session.TrainerEmail,
                PartId = e.Session.PartId,
                PartTitle = e.Session.Part.Title,
                PartOrderIndex = e.Session.Part.OrderIndex,
                TrainingId = e.Session.Part.TrainingId,
                TrainingTitle = e.Session.Part.Training.Title,
                MaxCapacity = e.Session.MaxCapacity,
            })
            .OrderBy(e => e.SessionStartUtc)
            .ToListAsync(cancellationToken);

        var grouped = enrollments
            .GroupBy(e => e.TrainingId)
            .Select(g =>
            {
                var trainingEnrollments = g.OrderBy(e => e.PartOrderIndex).ToList();
                return new MyEnrollmentSummaryDto
                {
                    TrainingId = g.Key,
                    TrainingTitle = trainingEnrollments.First().TrainingTitle,
                    TotalEnrolledParts = trainingEnrollments.Count,
                    NextSessionUtc = trainingEnrollments
                        .Where(e => e.SessionStartUtc > DateTime.UtcNow && e.Status == EnrollmentStatus.Enrolled)
                        .Select(e => (DateTime?)e.SessionStartUtc)
                        .FirstOrDefault(),
                    Sessions = trainingEnrollments.Select(e => new MyEnrollmentSessionDto
                    {
                        EnrollmentId = e.Id,
                        SessionId = e.SessionId,
                        PartId = e.PartId,
                        PartTitle = e.PartTitle,
                        PartOrderIndex = e.PartOrderIndex,
                        StartUtc = e.SessionStartUtc,
                        EndUtc = e.SessionEndUtc,
                        Room = e.Room,
                        TrainerName = e.TrainerName,
                        TrainerEmail = e.TrainerEmail,
                        Status = e.Status.ToString(),
                        WaitlistPosition = e.WaitlistPosition,
                        MaxCapacity = e.MaxCapacity,
                        EnrolledAt = e.CreatedAt,
                    }).ToList()
                };
            })
            .OrderBy(s => s.NextSessionUtc ?? DateTime.MaxValue)
            .ToList();

        return Result.Success(grouped);
    }
}
