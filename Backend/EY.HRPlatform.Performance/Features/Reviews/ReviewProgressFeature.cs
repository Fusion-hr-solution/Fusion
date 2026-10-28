using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

/// <summary>
/// One person's step in an active review round, keyed by Core HR's stable employee key so the org chart can place
/// it. The step and its due date only: never a rating, so a subject in calibration sees only that it is under way.
/// </summary>
public sealed record ReviewProgressPersonDto(string EmployeeKey, PerformanceReviewState State, DateOnly? DueDate, bool IsOverdue);

/// <summary>Review progress for the org chart's lens (B-131): the reviews the caller may read, as of today.</summary>
public sealed record ReviewProgressDto(IReadOnlyList<ReviewProgressPersonDto> People);

public sealed record GetReviewProgressQuery(ReviewActor Actor) : IQuery<Result<ReviewProgressDto>>;

public sealed class GetReviewProgressHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetReviewProgressQuery, Result<ReviewProgressDto>>
{
    public async Task<Result<ReviewProgressDto>> Handle(GetReviewProgressQuery request, CancellationToken cancellationToken)
    {
        // Performance's one read rule for reviews: administrators every review, everyone else their own and those they write.
        var rows = await (from review in ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(), request.Actor)
                          join round in db.ReviewRounds.AsNoTracking() on review.ReviewRoundId equals round.Id
                          where round.State == ReviewRoundState.Active && review.State != PerformanceReviewState.Closed
                          orderby review.OpenedAt descending
                          select new { review.SubjectEmployeeId, review.State, review.CurrentStageDueDate })
            .ToListAsync(cancellationToken);
        // Two active rounds can hold the same person: the latest one opened speaks for them.
        var latest = rows.DistinctBy(row => row.SubjectEmployeeId).ToList();
        if (latest.Count == 0) return Result.Success(new ReviewProgressDto([]));

        // People belong to Core HR: their chart key comes from the workforce snapshot, never from the key's format.
        IReadOnlyList<WorkforceSnapshot> people;
        try { people = await workforce.ResolveAsync(PerformanceClock.UtcNow, latest.Select(row => row.SubjectEmployeeId).ToList(), cancellationToken); }
        catch (HttpRequestException) { return Result.Failure<ReviewProgressDto>(PerformanceErrors.CoreUnavailable()); }
        var keyOf = people.ToDictionary(person => person.EmployeeId, person => person.StableEmployeeKey);

        var today = PerformanceClock.Today;
        return Result.Success(new ReviewProgressDto(latest
            .Where(row => keyOf.ContainsKey(row.SubjectEmployeeId))
            .Select(row => new ReviewProgressPersonDto(keyOf[row.SubjectEmployeeId], row.State, row.CurrentStageDueDate,
                row.State is PerformanceReviewState.SelfAssessment or PerformanceReviewState.ManagerAssessment
                    && row.CurrentStageDueDate is DateOnly due && due < today))
            .ToList()));
    }
}
