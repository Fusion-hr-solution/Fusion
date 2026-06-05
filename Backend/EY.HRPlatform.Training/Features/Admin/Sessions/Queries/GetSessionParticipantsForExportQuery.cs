using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Queries;

/// <summary>
/// Returns the full participant list for a session, joined with employee profile data
/// (grade, service line) for export purposes.
/// </summary>
public record GetSessionParticipantsForExportQuery(Guid SessionId)
    : IQuery<Result<SessionParticipantExportDto>>;

public class GetSessionParticipantsForExportQueryHandler
    : IQueryHandler<GetSessionParticipantsForExportQuery, Result<SessionParticipantExportDto>>
{
    private readonly TrainingDbContext _db;

    public GetSessionParticipantsForExportQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<SessionParticipantExportDto>> Handle(
        GetSessionParticipantsForExportQuery request, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.Id == request.SessionId)
            .Select(s => new SessionParticipantExportDto
            {
                SessionId = s.Id,
                TrainingTitle = s.Part.Training.Title,
                PartTitle = s.Part.Title,
                StartUtc = s.StartUtc,
                EndUtc = s.EndUtc,
                Room = s.Room,
                MaxCapacity = s.MaxCapacity,
                TrainerName = s.TrainerName,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (session is null)
            return Result.Failure<SessionParticipantExportDto>(Error.NotFound("TrainingSession", request.SessionId));

        // Left-join enrollments to EmployeeProfile (and from there to Grade / ServiceLine)
        // so participants are returned even when they have no profile yet.
        // Note: SessionEnrollment in this service does not store the employee's display
        // name or email; only EmployeeId is available here. Name/email enrichment is
        // expected to happen via Identity-service lookup (out of scope for this query).
        var rows = await (
            from e in _db.SessionEnrollments.AsNoTracking()
            where e.SessionId == request.SessionId
                  && e.Status != EnrollmentStatus.Cancelled
            join p in _db.Set<Domain.Entities.EmployeeProfile>().AsNoTracking()
                on e.EmployeeId equals p.EmployeeId into profileJoin
            from profile in profileJoin.DefaultIfEmpty()
            orderby e.CreatedAt
            select new SessionParticipantRowDto
            {
                EmployeeId = e.EmployeeId,
                FullName = string.Empty,
                Email = string.Empty,
                Grade = profile != null && profile.Grade != null ? profile.Grade.Name : null,
                ServiceLine = profile != null && profile.ServiceLine != null ? profile.ServiceLine.Name : null,
                EnrollmentDate = e.CreatedAt,
                AttendanceStatus = e.Status.ToString(),
            }
        ).ToListAsync(cancellationToken);

        session.Participants = rows;
        return Result.Success(session);
    }
}
