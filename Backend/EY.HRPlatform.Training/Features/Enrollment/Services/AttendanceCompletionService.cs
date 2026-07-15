using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Services;

/// <summary>
/// ADR 0005: when an employee attends a session, materialise on-site training completion into
/// <see cref="TrainingProgress"/> once every Part of the training has an attended session.
/// </summary>
public interface IAttendanceCompletionService
{
    /// <summary>
    /// Stages a completed <see cref="TrainingProgress"/> (without saving) when, counting the
    /// just-attended session, the employee now has an attended session for every Part of the
    /// training. The caller's SaveChanges persists this atomically with the attendance mark.
    /// </summary>
    Task TryCompleteOnSiteTrainingAsync(
        Guid employeeId,
        Guid trainingId,
        Guid justAttendedSessionId,
        CancellationToken cancellationToken);
}

public class AttendanceCompletionService : IAttendanceCompletionService
{
    private readonly TrainingDbContext _db;

    public AttendanceCompletionService(TrainingDbContext db) => _db = db;

    public async Task TryCompleteOnSiteTrainingAsync(
        Guid employeeId,
        Guid trainingId,
        Guid justAttendedSessionId,
        CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .Include(t => t.Parts)
                .ThenInclude(p => p.Sessions)
            .FirstOrDefaultAsync(t => t.Id == trainingId, cancellationToken);

        if (training is null || training.Parts.Count == 0)
            return;

        // Non-cancelled session ids across the whole training.
        var sessionIds = training.Parts
            .SelectMany(p => p.Sessions)
            .Where(s => s.Status != SessionStatus.Cancelled)
            .Select(s => s.Id)
            .ToList();

        // Sessions the employee has already attended (persisted) + the one being marked now
        // (not yet saved, so it is added explicitly rather than re-queried).
        var attendedSessionIds = await _db.SessionEnrollments
            .Where(e => e.EmployeeId == employeeId
                && e.Status == EnrollmentStatus.Attended
                && sessionIds.Contains(e.SessionId))
            .Select(e => e.SessionId)
            .ToListAsync(cancellationToken);

        var attended = attendedSessionIds.ToHashSet();
        attended.Add(justAttendedSessionId);

        // Every Part that has at least one non-cancelled session must have an attended session.
        foreach (var part in training.Parts)
        {
            var partSessionIds = part.Sessions
                .Where(s => s.Status != SessionStatus.Cancelled)
                .Select(s => s.Id)
                .ToList();

            if (partSessionIds.Count == 0)
                continue; // a part with no live sessions is vacuously satisfied

            if (!partSessionIds.Any(attended.Contains))
                return; // this part is not yet attended — training is not complete
        }

        // All parts attended → create-or-complete the progress record (idempotent).
        var progress = await _db.TrainingProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.TrainingId == trainingId, cancellationToken);

        if (progress is null)
        {
            progress = new TrainingProgress(employeeId, trainingId);
            _db.TrainingProgress.Add(progress);
            // Set StartedAt so an on-site completion has the same lifecycle shape as e-learning
            // (NotStarted → InProgress → Completed), never jumping straight to Completed.
            progress.Start();
        }

        if (progress.Status != TrainingStatus.Completed)
            progress.Complete();
    }
}
