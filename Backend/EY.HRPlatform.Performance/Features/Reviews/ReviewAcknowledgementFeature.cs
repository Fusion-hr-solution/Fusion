using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

public sealed record AcknowledgeReviewCommand(Guid ReviewId, Guid ActorEmployeeId, string? Comment) : ICommand<Result<ReviewAcknowledgementDto>>;

/// <summary>
/// The person's "I've read this" on a released result (D-20): once, idempotent, never a change to the result.
/// The reviewer is told; the email and the audit entry carry no comment.
/// </summary>
public sealed class AcknowledgeReviewHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<AcknowledgeReviewCommand, Result<ReviewAcknowledgementDto>>
{
    public async Task<Result<ReviewAcknowledgementDto>> Handle(AcknowledgeReviewCommand command, CancellationToken token)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(r => r.Id == command.ReviewId, token);
        if (review is null) return Result.Failure<ReviewAcknowledgementDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        bool changed;
        try { changed = review.Acknowledge(command.ActorEmployeeId, command.Comment, PerformanceClock.UtcNow); }
        catch (UnauthorizedAccessException)
        {
            return Result.Failure<ReviewAcknowledgementDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ReviewAssessmentForbidden,
                "Only the person reviewed acknowledges their result."));
        }
        catch (ArgumentException ex) { return Result.Failure<ReviewAcknowledgementDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAcknowledgementInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewAcknowledgementDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewNotReleased, ex.Message)); }
        var result = new ReviewAcknowledgementDto(review.AcknowledgedAt!.Value, review.AcknowledgementComment);
        if (!changed) return Result.Success(result);

        var round = await db.ReviewRounds.AsNoTracking().SingleAsync(r => r.Id == review.ReviewRoundId, token);
        var href = Infrastructure.Notifications.PerformanceNotificationTemplates.ReviewPath(review.Id);
        notifications.EnqueueReviewWork(review, PerformanceNotificationKind.ReviewAcknowledged, review.ReviewerEmployeeId, "PerformanceReview",
            review.Id, $"{PerformanceNotificationKind.ReviewAcknowledged}:{review.Id:N}:{review.ReviewerEmployeeId:N}",
            new ReviewWorkNotificationPayload(review.CycleId, round.Id, review.Id, round.Name, href, review.SubjectDisplayName, review.SubjectDisplayName),
            PerformanceNotificationTemplates.ForAcknowledged(review.SubjectDisplayName, round.Name, review.Id));
        audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewAcknowledged,
            new { acknowledgedAt = review.AcknowledgedAt, hasComment = review.AcknowledgementComment is not null });
        await db.SaveChangesAsync(token);
        return Result.Success(result);
    }
}
