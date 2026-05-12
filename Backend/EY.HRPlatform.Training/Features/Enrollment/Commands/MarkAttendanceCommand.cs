using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Commands;

public record MarkAttendanceCommand(
    Guid SessionId,
    Guid EmployeeId) : ICommand<Result>;

public class MarkAttendanceCommandHandler : ICommandHandler<MarkAttendanceCommand, Result>
{
    private readonly TrainingDbContext _db;

    public MarkAttendanceCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(MarkAttendanceCommand request, CancellationToken cancellationToken)
    {
        var enrollment = await _db.SessionEnrollments
            .Include(e => e.Session)
            .FirstOrDefaultAsync(e =>
                e.EmployeeId == request.EmployeeId
                && e.SessionId == request.SessionId
                && e.Status == EnrollmentStatus.Enrolled,
                cancellationToken);

        if (enrollment is null)
            return Result.Failure(Error.NotFound("SessionEnrollment", request.SessionId));

        enrollment.MarkAttended();
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
