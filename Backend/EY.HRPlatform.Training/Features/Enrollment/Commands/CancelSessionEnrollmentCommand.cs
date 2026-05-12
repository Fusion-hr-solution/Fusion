using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Commands;

public record CancelSessionEnrollmentCommand(
    Guid EmployeeId,
    Guid SessionId,
    int CancellationDeadlineHours = 24) : ICommand<Result>;

public class CancelSessionEnrollmentCommandHandler : ICommandHandler<CancelSessionEnrollmentCommand, Result>
{
    private readonly TrainingDbContext _db;

    public CancelSessionEnrollmentCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(CancelSessionEnrollmentCommand request, CancellationToken cancellationToken)
    {
        var enrollment = await _db.SessionEnrollments
            .Include(e => e.Session)
            .FirstOrDefaultAsync(e =>
                e.EmployeeId == request.EmployeeId
                && e.SessionId == request.SessionId
                && e.Status != EnrollmentStatus.Cancelled,
                cancellationToken);

        if (enrollment is null)
            return Result.Failure(Error.NotFound("SessionEnrollment", request.SessionId));

        // Check cancellation deadline
        var nowUtc = DateTime.UtcNow;
        var deadline = enrollment.Session.StartUtc.AddHours(-request.CancellationDeadlineHours);

        if (nowUtc > deadline)
            return Result.Failure(Error.Validation("Enrollment.CancellationDeadlinePassed",
                $"Cancellation must be made at least {request.CancellationDeadlineHours} hours before the session starts."));

        // Cannot cancel if session already started or completed
        var effectiveStatus = enrollment.Session.EffectiveStatus(nowUtc);
        if (effectiveStatus is SessionStatus.InProgress or SessionStatus.Completed)
            return Result.Failure(Error.Validation("Enrollment.SessionAlreadyStarted",
                "Cannot cancel enrollment for a session that has already started or completed."));

        var wasFull = enrollment.Status == EnrollmentStatus.Enrolled;
        enrollment.Cancel();

        // If this was a confirmed enrollment, promote the first waitlisted person
        if (wasFull)
        {
            var nextWaitlisted = await _db.SessionEnrollments
                .Where(e => e.SessionId == request.SessionId && e.Status == EnrollmentStatus.Waitlisted)
                .OrderBy(e => e.WaitlistPosition)
                .FirstOrDefaultAsync(cancellationToken);

            if (nextWaitlisted is not null)
            {
                nextWaitlisted.PromoteFromWaitlist();
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
