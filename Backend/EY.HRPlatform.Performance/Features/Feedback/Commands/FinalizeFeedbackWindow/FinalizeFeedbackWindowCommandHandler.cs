using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.FinalizeFeedbackWindow;

public sealed class FinalizeFeedbackWindowCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<FinalizeFeedbackWindowCommand, Result>
{
    public async Task<Result> Handle(FinalizeFeedbackWindowCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Feedback.EmployeeContextRequired",
                "An employee context is required to finalize the feedback window."));

        // 1. Load PerformanceCycle
        var cycle = await dbContext.PerformanceCycles.SingleOrDefaultAsync(
            item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure(Error.NotFound("PerformanceCycle", request.CycleId));

        // 2. Feedback-window governance was part of the removed governed launch path; there is
        // no persisted feedback deadline to gate on.

        // Parse feedback type
        if (!Enum.TryParse<CampaignWorkItemType>(request.FeedbackType, ignoreCase: true, out var feedbackType) ||
            feedbackType is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
            return Result.Failure(Error.Validation("Feedback.InvalidFeedbackType",
                "Feedback type must be PeerFeedback or UpwardFeedback."));

        // 3. Load all Submitted responses for this cycle + type + subject
        var responses = await dbContext.FeedbackResponseContents
            .Where(r => r.CycleId == request.CycleId &&
                        r.FeedbackType == feedbackType &&
                        r.SubjectEmployeeId == request.SubjectEmployeeId &&
                        r.Status == FeedbackResponseStatus.Submitted)
            .ToListAsync(cancellationToken);

        // 4. Lock each response (Submitted -> Locked)
        foreach (var response in responses)
        {
            try
            {
                response.Lock(DateTime.UtcNow);
            }
            catch (DomainRuleViolationException)
            {
                // Skip responses that cannot be locked (already locked, etc.)
            }
        }

        // 5. Count valid submitted responses (non-withdrawn, non-invalidated)
        var validCount = responses.Count(r => !r.IsInvalidated);

        // 6. Evaluate threshold (governance removed; default minimum)
        const int frozenThreshold = 3;

        if (validCount < frozenThreshold)
        {
            // Emit FeedbackSuppressed audit event (D-09/D-11)
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                cycle.TenantId, cycle.Id, PerformanceCycleAuditAction.FeedbackSuppressed,
                currentUser.UserId, currentUser.FullName,
                $"Feedback window finalized: {validCount} responses below threshold ({frozenThreshold}). Feedback suppressed."));
        }
        else
        {
            // Emit FeedbackThresholdReached audit event
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                cycle.TenantId, cycle.Id, PerformanceCycleAuditAction.FeedbackThresholdReached,
                currentUser.UserId, currentUser.FullName,
                $"Feedback window finalized: {validCount} responses met threshold ({frozenThreshold})."));

            // Emit FeedbackResponseLocked for each locked response
            foreach (var response in responses.Where(r => r.Status == FeedbackResponseStatus.Locked))
            {
                dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                    cycle.TenantId, cycle.Id, PerformanceCycleAuditAction.FeedbackResponseLocked,
                    currentUser.UserId, currentUser.FullName,
                    "Feedback response locked at window close."));
            }
        }

        // 8. SaveChanges
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
