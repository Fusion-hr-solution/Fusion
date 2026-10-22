using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

public sealed record ReviseReviewSummaryRequest(string Summary, uint ExpectedVersion);
public sealed record ReviewSummaryStateDto(Guid ReviewId, string Summary, DateTime? SummaryRevisedAt, DateTime? SummaryCheckedAt, uint Version);

public sealed record ReviseReviewSummaryCommand(Guid ReviewId, ReviewActor Actor, string Summary, uint ExpectedVersion) : ICommand<Result<ReviewSummaryStateDto>>;
public sealed record MarkReviewSummaryCheckedCommand(Guid ReviewId, ReviewActor Actor) : ICommand<Result<ReviewSummaryStateDto>>;

/// <summary>
/// After calibration changed a rating, the reviewer may rewrite the overall summary until release, or keep it as is
/// (call 7, accepted with the slice 5 canvas). Nothing else of the assessment reopens. Audited without the text.
/// </summary>
internal static class ReviewSummaryRevision
{
    public static async Task<Result<PerformanceReview>> LoadAsync(PerformanceDbContext db, Guid reviewId, ReviewActor actor, CancellationToken token)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(item => item.Id == reviewId, token);
        if (review is null) return Result.Failure<PerformanceReview>(PerformanceErrors.NotFound("PerformanceReview", reviewId));
        if (!actor.CanReviewReports || actor.EmployeeId == Guid.Empty || actor.EmployeeId != review.ReviewerEmployeeId)
            return Result.Failure<PerformanceReview>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ReviewAssessmentForbidden,
                "Only the reviewer of record can revise this summary."));
        return Result.Success(review);
    }

    public static ReviewSummaryStateDto ToDto(PerformanceReview review)
        => new(review.Id, review.ManagerAssessment.Summary, review.SummaryRevisedAt, review.SummaryCheckedAt, review.Version);

    public static Error NotRevisable(string message)
        => PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewSummaryNotRevisable, message);
}

public sealed class ReviseReviewSummaryHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<ReviseReviewSummaryCommand, Result<ReviewSummaryStateDto>>
{
    public async Task<Result<ReviewSummaryStateDto>> Handle(ReviseReviewSummaryCommand command, CancellationToken token)
    {
        var loaded = await ReviewSummaryRevision.LoadAsync(db, command.ReviewId, command.Actor, token);
        if (loaded.IsFailure) return Result.Failure<ReviewSummaryStateDto>(loaded.Error);
        var review = loaded.Value;
        if (VersionGuard.Check(review, command.ExpectedVersion) is { } stale) return Result.Failure<ReviewSummaryStateDto>(stale);
        bool changed;
        try { changed = review.ReviseSummaryAfterCalibration(command.Actor.EmployeeId, command.Summary, PerformanceClock.UtcNow); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewSummaryStateDto>(ReviewSummaryRevision.NotRevisable(ex.Message)); }
        catch (ArgumentException ex)
        {
            return Result.Failure<ReviewSummaryStateDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAssessmentInvalid, ex.Message));
        }
        if (!changed) return Result.Success(ReviewSummaryRevision.ToDto(review));
        audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewSummaryRevised,
            new { revisedAt = review.SummaryRevisedAt });
        await db.SaveChangesAsync(token);
        return Result.Success(ReviewSummaryRevision.ToDto(review));
    }
}

public sealed class MarkReviewSummaryCheckedHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<MarkReviewSummaryCheckedCommand, Result<ReviewSummaryStateDto>>
{
    public async Task<Result<ReviewSummaryStateDto>> Handle(MarkReviewSummaryCheckedCommand command, CancellationToken token)
    {
        var loaded = await ReviewSummaryRevision.LoadAsync(db, command.ReviewId, command.Actor, token);
        if (loaded.IsFailure) return Result.Failure<ReviewSummaryStateDto>(loaded.Error);
        var review = loaded.Value;
        bool changed;
        try { changed = review.MarkSummaryChecked(command.Actor.EmployeeId, PerformanceClock.UtcNow); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewSummaryStateDto>(ReviewSummaryRevision.NotRevisable(ex.Message)); }
        if (!changed) return Result.Success(ReviewSummaryRevision.ToDto(review));
        audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewSummaryChecked,
            new { checkedAt = review.SummaryCheckedAt });
        await db.SaveChangesAsync(token);
        return Result.Success(ReviewSummaryRevision.ToDto(review));
    }
}
