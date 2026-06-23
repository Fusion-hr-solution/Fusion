using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackThresholdStatus;

/// <summary>
/// Returns per-cohort threshold status: current count, minimum required, suppression flags.
/// D-08: per-type per-subject cohort.
/// D-09: hard suppression below threshold — CurrentCount visibility restricted per consumer role.
/// </summary>
public sealed class GetFeedbackThresholdStatusQueryHandler(
    PerformanceDbContext dbContext)
    : IQueryHandler<GetFeedbackThresholdStatusQuery, Result<FeedbackThresholdStatusDto>>
{
    public async Task<Result<FeedbackThresholdStatusDto>> Handle(
        GetFeedbackThresholdStatusQuery request,
        CancellationToken cancellationToken)
    {
        // 1. Load PerformanceCycle — fail NotFound if missing
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<FeedbackThresholdStatusDto>(
                Error.NotFound("PerformanceCycle", request.CycleId));

        // 2. Read frozen threshold
        var frozenMinimum = cycle.FrozenMinimumAnonymousFeedbackResponses
                            ?? cycle.MinimumAnonymousFeedbackResponses;

        // 3. Count valid submitted responses per cohort
        var validCount = await dbContext.FeedbackResponseContents
            .AsNoTracking()
            .CountAsync(r =>
                r.CycleId == request.CycleId &&
                r.SubjectEmployeeId == request.SubjectEmployeeId &&
                r.FeedbackType == request.FeedbackType &&
                r.Status == FeedbackResponseStatus.Submitted &&
                !r.IsInvalidated,
            cancellationToken);

        // 4. Evaluate threshold
        var isSuppressed = validCount < frozenMinimum;
        var isReleased = validCount >= frozenMinimum;

        return new FeedbackThresholdStatusDto(
            CycleId: request.CycleId,
            SubjectEmployeeId: request.SubjectEmployeeId,
            FeedbackType: request.FeedbackType.ToString(),
            CurrentCount: validCount,
            MinimumRequired: frozenMinimum,
            IsSuppressed: isSuppressed,
            IsReleased: isReleased);
    }
}
