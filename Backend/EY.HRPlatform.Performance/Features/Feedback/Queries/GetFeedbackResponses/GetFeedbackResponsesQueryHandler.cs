using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackResponses;

/// <summary>
/// Retrieves anonymized feedback responses for a subject + type cohort.
/// D-06: queries only FeedbackResponseContents — never joins FeedbackIdentityMappings.
/// D-08/D-09: suppresses output when cohort is below minimum threshold.
/// D-12: immediate release when threshold is met.
/// </summary>
public sealed class GetFeedbackResponsesQueryHandler(
    PerformanceDbContext dbContext)
    : IQueryHandler<GetFeedbackResponsesQuery, Result<FeedbackResponseListDto>>
{
    public async Task<Result<FeedbackResponseListDto>> Handle(
        GetFeedbackResponsesQuery request,
        CancellationToken cancellationToken)
    {
        // 1. Load PerformanceCycle — fail NotFound if missing
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<FeedbackResponseListDto>(
                Error.NotFound("PerformanceCycle", request.CycleId));

        // 2. Read FrozenMinimumAnonymousFeedbackResponses from governance
        var frozenMinimum = cycle.FrozenMinimumAnonymousFeedbackResponses
                            ?? cycle.MinimumAnonymousFeedbackResponses;

        // 3. Count valid submitted responses per cohort
        //    D-06: queries ONLY FeedbackResponseContents — never touches FeedbackIdentityMappings
        var validCount = await dbContext.FeedbackResponseContents
            .AsNoTracking()
            .CountAsync(r =>
                r.CycleId == request.CycleId &&
                r.SubjectEmployeeId == request.SubjectEmployeeId &&
                r.FeedbackType == request.FeedbackType &&
                (r.Status == FeedbackResponseStatus.Submitted || r.Status == FeedbackResponseStatus.Locked) &&
                !r.IsInvalidated,
            cancellationToken);

        // 4. D-09: hard suppression below threshold
        //    No individual responses, no reviewer identities, no exact count to normal consumers
        if (validCount < frozenMinimum)
        {
            return new FeedbackResponseListDto(
                Responses: [],
                IsSuppressed: true,
                CurrentCount: 0,
                MinimumRequired: frozenMinimum);
        }

        // 5. D-12: immediate release — query FeedbackResponseContents (same filter, AsNoTracking)
        //    Map to DTOs. NEVER reference FeedbackIdentityMappings (D-06)
        var responses = await dbContext.FeedbackResponseContents
            .AsNoTracking()
            .Where(r =>
                r.CycleId == request.CycleId &&
                r.SubjectEmployeeId == request.SubjectEmployeeId &&
                r.FeedbackType == request.FeedbackType &&
                (r.Status == FeedbackResponseStatus.Submitted || r.Status == FeedbackResponseStatus.Locked) &&
                !r.IsInvalidated)
            .Select(r => new FeedbackResponseItemDto(
                r.Id,
                r.Answers.Select(a => new FeedbackPromptAnswerDto(
                    a.PromptSnapshotId,
                    a.PromptText,
                    a.PromptVersion,
                    a.AnswerText,
                    a.IsRequired)).ToList(),
                null, // GeneralComment stored in FeedbackResponseVersion, not on entity
                r.SubmittedAt!.Value))
            .ToListAsync(cancellationToken);

        return new FeedbackResponseListDto(
            Responses: responses,
            IsSuppressed: false,
            CurrentCount: validCount,
            MinimumRequired: frozenMinimum);
    }
}
