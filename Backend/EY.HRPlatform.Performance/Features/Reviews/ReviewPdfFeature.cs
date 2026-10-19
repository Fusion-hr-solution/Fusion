using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Pdf;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

public sealed record ReviewPdfDto(string FileName, byte[] Content);
public sealed record DownloadReviewPdfCommand(Guid ReviewId, ReviewActor Actor) : ICommand<Result<ReviewPdfDto>>;

/// <summary>
/// The released review's PDF (D8, D-21), rendered per request from the reader's projection of the finalized record.
/// The person, the reviewer of record and round administrators download it; a calibration seat doesn't. Audited.
/// </summary>
public sealed class DownloadReviewPdfHandler(PerformanceDbContext db, IPerformanceAudit audit) : ICommandHandler<DownloadReviewPdfCommand, Result<ReviewPdfDto>>
{
    public async Task<Result<ReviewPdfDto>> Handle(DownloadReviewPdfCommand query, CancellationToken token)
    {
        var actor = query.Actor with { CalibratorUserId = null, IsCalibrationFacilitator = false };
        var composed = await new GetPerformanceReviewHandler(db).Handle(new GetPerformanceReviewQuery(query.ReviewId, actor), token);
        if (composed.IsFailure) return Result.Failure<ReviewPdfDto>(composed.Error);
        var review = composed.Value;
        if (review.Lens is not ("Subject" or "Reviewer" or "Administrator"))
            return Result.Failure<ReviewPdfDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ReviewAssessmentForbidden,
                "You do not have a relationship to this review."));
        if (review.State != PerformanceReviewState.Finalized)
            return Result.Failure<ReviewPdfDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewNotReleased,
                "A review has a PDF once it is released."));
        var content = ReviewPdfRenderer.Render(review);
        var tenantId = await db.PerformanceReviews.AsNoTracking().Where(r => r.Id == review.Id).Select(r => r.TenantId).SingleAsync(token);
        audit.Record(tenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewPdfDownloaded,
            new { copy = review.Lens });
        await db.SaveChangesAsync(token);
        var name = string.Concat($"{review.ReviewRoundName} {review.SubjectDisplayName}".Select(c => char.IsLetterOrDigit(c) ? c : '-'))
            .Trim('-').ToLowerInvariant();
        return Result.Success(new ReviewPdfDto($"{name}.pdf", content));
    }
}
