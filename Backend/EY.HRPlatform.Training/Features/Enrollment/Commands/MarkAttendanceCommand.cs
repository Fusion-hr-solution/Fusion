using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Enrollment.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Commands;

public record MarkAttendanceCommand(
    Guid SessionId,
    Guid EmployeeId) : ICommand<Result>;

public class MarkAttendanceCommandHandler : ICommandHandler<MarkAttendanceCommand, Result>
{
    private readonly TrainingDbContext _db;
    private readonly IAttendanceCompletionService _completion;

    public MarkAttendanceCommandHandler(TrainingDbContext db, IAttendanceCompletionService completion)
    {
        _db = db;
        _completion = completion;
    }

    public async Task<Result> Handle(MarkAttendanceCommand request, CancellationToken cancellationToken)
    {
        var enrollment = await _db.SessionEnrollments
            .Include(e => e.Session).ThenInclude(s => s.Part)
            .FirstOrDefaultAsync(e =>
                e.EmployeeId == request.EmployeeId
                && e.SessionId == request.SessionId
                && e.Status == EnrollmentStatus.Enrolled,
                cancellationToken);

        if (enrollment is null)
            return Result.Failure(Error.Validation(
                "SessionEnrollment.NotFound",
                $"No active enrollment found for EmployeeId '{request.EmployeeId}' and SessionId '{request.SessionId}'."));

        enrollment.MarkAttended();

        // ADR 0005: materialise on-site training completion if this was the final part.
        await _completion.TryCompleteOnSiteTrainingAsync(
            request.EmployeeId,
            enrollment.Session.Part.TrainingId,
            enrollment.SessionId,
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
