using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Enrollment.Commands;

public record EnrollInSessionsCommand(
    Guid EmployeeId,
    Guid TrainingId,
    List<SessionSelectionItem> Selections) : ICommand<Result<EnrollInSessionsResultDto>>;

public record SessionSelectionItem(Guid PartId, Guid SessionId);

public class EnrollInSessionsCommandHandler : ICommandHandler<EnrollInSessionsCommand, Result<EnrollInSessionsResultDto>>
{
    private readonly TrainingDbContext _db;

    public EnrollInSessionsCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<EnrollInSessionsResultDto>> Handle(EnrollInSessionsCommand request, CancellationToken cancellationToken)
    {
        // Validate training exists and is OnSite
        var training = await _db.Trainings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure<EnrollInSessionsResultDto>(Error.NotFound("Training", request.TrainingId));

        if (training.TrainingType != TrainingType.OnSite)
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Validation("Enrollment.NotOnSite", "Session enrollment is only available for on-site trainings."));

        // Get all parts for this training
        var parts = await _db.TrainingParts
            .AsNoTracking()
            .Where(p => p.TrainingId == request.TrainingId)
            .ToListAsync(cancellationToken);

        if (parts.Count == 0)
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Validation("Enrollment.NoParts", "This training has no parts configured."));

        // Validate selections: exactly one per part, no duplicates
        var partIds = parts.Select(p => p.Id).ToHashSet();
        var selectedPartIds = request.Selections.Select(s => s.PartId).ToList();

        if (selectedPartIds.Count != selectedPartIds.Distinct().Count())
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Validation("Enrollment.DuplicatePartSelection", "Each part must have exactly one session selection."));

        // Only require selections for parts that have at least one non-cancelled/non-completed session
        var nowUtc = DateTime.UtcNow;

        var allPartSessions = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => partIds.Contains(s.PartId))
            .ToListAsync(cancellationToken);

        var enrollablePartIds = allPartSessions
            .Where(s => s.EffectiveStatus(nowUtc) is not (SessionStatus.Cancelled or SessionStatus.Completed))
            .Select(s => s.PartId)
            .Distinct()
            .ToHashSet();

        if (enrollablePartIds.Count == 0)
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Validation("Enrollment.NoAvailableSessions", "No sessions are currently available for enrollment."));

        // All selected parts must belong to this training
        if (!selectedPartIds.ToHashSet().IsSubsetOf(partIds))
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Validation("Enrollment.InvalidPart", "One or more selected parts do not belong to this training."));

        // All parts with available sessions must be covered
        if (!enrollablePartIds.IsSubsetOf(selectedPartIds.ToHashSet()))
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Validation("Enrollment.IncompleteSelection", "You must select a session for each part that has available sessions."));

        // Validate each selected session belongs to its part and is valid
        var selectedSessionIds = request.Selections.Select(s => s.SessionId).ToList();
        var sessions = await _db.TrainingSessions
            .Where(s => selectedSessionIds.Contains(s.Id))
            .ToListAsync(cancellationToken);

        foreach (var selection in request.Selections)
        {
            var session = sessions.FirstOrDefault(s => s.Id == selection.SessionId);
            if (session is null)
                return Result.Failure<EnrollInSessionsResultDto>(
                    Error.NotFound("TrainingSession", selection.SessionId));

            if (session.PartId != selection.PartId)
                return Result.Failure<EnrollInSessionsResultDto>(
                    Error.Validation("Enrollment.SessionPartMismatch",
                        $"Session '{selection.SessionId}' does not belong to part '{selection.PartId}'."));

            var effectiveStatus = session.EffectiveStatus(nowUtc);
            if (effectiveStatus == SessionStatus.Cancelled)
                return Result.Failure<EnrollInSessionsResultDto>(
                    Error.Validation("Enrollment.SessionCancelled",
                        $"Session '{selection.SessionId}' has been cancelled."));

            if (effectiveStatus == SessionStatus.Completed)
                return Result.Failure<EnrollInSessionsResultDto>(
                    Error.Validation("Enrollment.SessionCompleted",
                        $"Session '{selection.SessionId}' has already ended."));
        }

        // Check if already enrolled in other sessions for the same parts
        var sessionIdsForParts = await _db.TrainingSessions
            .Where(s => partIds.Contains(s.PartId))
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        var existingPartEnrollments = await _db.SessionEnrollments
            .Include(e => e.Session)
            .Where(e => e.EmployeeId == request.EmployeeId
                && sessionIdsForParts.Contains(e.SessionId)
                && e.Status != EnrollmentStatus.Cancelled)
            .ToListAsync(cancellationToken);

        if (existingPartEnrollments.Count > 0)
            return Result.Failure<EnrollInSessionsResultDto>(
                Error.Conflict("Enrollment.AlreadyEnrolled",
                    "You are already enrolled in sessions for this training. Cancel existing enrollments first."));

        // Count current enrollments for capacity check + precompute waitlist positions
        var enrollmentCounts = await _db.SessionEnrollments
            .Where(e => selectedSessionIds.Contains(e.SessionId) && e.Status == EnrollmentStatus.Enrolled)
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var countMap = enrollmentCounts.ToDictionary(x => x.SessionId, x => x.Count);

        var maxWaitlistPositions = await _db.SessionEnrollments
            .Where(e => selectedSessionIds.Contains(e.SessionId) && e.Status == EnrollmentStatus.Waitlisted)
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, MaxPos = g.Max(e => e.WaitlistPosition) })
            .ToListAsync(cancellationToken);

        var waitlistPosMap = maxWaitlistPositions.ToDictionary(x => x.SessionId, x => x.MaxPos);

        // Use a transaction for concurrency safety on capacity/waitlist
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // Create enrollments
        var enrollments = new List<SessionEnrollment>();
        var resultItems = new List<EnrollmentResultItemDto>();

        foreach (var selection in request.Selections)
        {
            var session = sessions.First(s => s.Id == selection.SessionId);
            var currentCount = countMap.GetValueOrDefault(selection.SessionId, 0);

            EnrollmentStatus status;
            int waitlistPosition = 0;

            if (currentCount < session.MaxCapacity)
            {
                status = EnrollmentStatus.Enrolled;
            }
            else
            {
                var maxWaitlistPos = waitlistPosMap.GetValueOrDefault(selection.SessionId, 0);
                waitlistPosition = maxWaitlistPos + 1;
                waitlistPosMap[selection.SessionId] = waitlistPosition;
                status = EnrollmentStatus.Waitlisted;
            }

            var enrollment = new SessionEnrollment(selection.SessionId, request.EmployeeId, status, waitlistPosition);
            enrollments.Add(enrollment);

            resultItems.Add(new EnrollmentResultItemDto
            {
                PartId = selection.PartId,
                SessionId = selection.SessionId,
                EnrollmentId = enrollment.Id,
                Status = status.ToString(),
                WaitlistPosition = waitlistPosition
            });
        }

        _db.SessionEnrollments.AddRange(enrollments);

        // Also create a TrainingAssignment if one doesn't exist
        var hasAssignment = await _db.Assignments
            .AnyAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId, cancellationToken);

        if (!hasAssignment)
        {
            var assignment = new TrainingAssignment(request.TrainingId, request.EmployeeId, AssignmentType.SelfEnroll);
            _db.Assignments.Add(assignment);
        }

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Result.Success(new EnrollInSessionsResultDto
        {
            TrainingId = request.TrainingId,
            Enrollments = resultItems
        });
    }
}
