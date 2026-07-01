using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>US-8.1.2 §3 — global feedback overview filters (category, format, period).</summary>
public record FeedbackOverviewFilter(Guid? CategoryId, string? Format, DateTime? From, DateTime? To);

public record GetFeedbackOverviewQuery(FeedbackOverviewFilter Filter)
    : IQuery<Result<FeedbackOverviewDto>>;

public class GetFeedbackOverviewQueryHandler
    : IQueryHandler<GetFeedbackOverviewQuery, Result<FeedbackOverviewDto>>
{
    private const int TopBottomCount = 5;

    /// <summary>
    /// Minimum responses for a training to be eligible for the top/bottom ranking — a statistical
    /// reliability gate (a single 5★ should not top the list). Distinct from, though numerically
    /// equal to, the comment-anonymity suppression threshold.
    /// </summary>
    private const int MinResponsesForRanking = 3;

    private readonly TrainingDbContext _db;

    public GetFeedbackOverviewQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<FeedbackOverviewDto>> Handle(
        GetFeedbackOverviewQuery request, CancellationToken cancellationToken)
    {
        var f = request.Filter;
        TrainingType? format = null;
        if (!string.IsNullOrWhiteSpace(f.Format) && Enum.TryParse<TrainingType>(f.Format, true, out var parsed))
            format = parsed;

        var fq = _db.TrainingFeedbacks.AsNoTracking().AsQueryable();
        if (f.From.HasValue) fq = fq.Where(x => x.SubmittedAt >= f.From.Value);
        if (f.To.HasValue) fq = fq.Where(x => x.SubmittedAt <= f.To.Value);
        if (f.CategoryId.HasValue) fq = fq.Where(x => x.Training.CategoryId == f.CategoryId.Value);
        if (format.HasValue) fq = fq.Where(x => x.Training.TrainingType == format.Value);

        var feedbacks = await fq
            .Select(x => new
            {
                x.OverallRating,
                x.WouldRecommend,
                x.SubmittedAt,
                x.TrainingId,
                TrainingTitle = x.Training.Title,
            })
            .ToListAsync(cancellationToken);

        var dto = new FeedbackOverviewDto { TotalFeedbacks = feedbacks.Count };

        if (feedbacks.Count > 0)
        {
            dto.AvgOverallRating = FeedbackAnalytics.AvgRating(feedbacks.Select(x => x.OverallRating));
            dto.RecommendationRate = FeedbackAnalytics.Rate(feedbacks.Count(x => x.WouldRecommend), feedbacks.Count);
            dto.RatingDistribution = FeedbackAnalytics.Distribution(feedbacks.Select(x => x.OverallRating));
            dto.MonthlyTrend = FeedbackAnalytics.MonthlyTrend(feedbacks.Select(x => (x.SubmittedAt, x.OverallRating)));

            var byTraining = feedbacks
                .GroupBy(x => new { x.TrainingId, x.TrainingTitle })
                .Select(g => new TrainingRatingDto
                {
                    TrainingId = g.Key.TrainingId,
                    TrainingTitle = g.Key.TrainingTitle,
                    AvgOverallRating = FeedbackAnalytics.AvgRating(g.Select(y => y.OverallRating)),
                    ResponseCount = g.Count(),
                })
                .Where(t => t.ResponseCount >= MinResponsesForRanking)
                .ToList();

            dto.TopTrainings = byTraining
                .OrderByDescending(t => t.AvgOverallRating).ThenByDescending(t => t.ResponseCount)
                .Take(TopBottomCount).ToList();
            dto.BottomTrainings = byTraining
                .OrderBy(t => t.AvgOverallRating).ThenByDescending(t => t.ResponseCount)
                .Take(TopBottomCount).ToList();
        }

        // Response rate = feedbacks ÷ completions since launch (same filter scope).
        var cq = _db.TrainingProgress.AsNoTracking()
            .Where(p => p.Status == TrainingStatus.Completed && p.CompletedAt >= FeedbackAnalytics.LaunchedAtUtc);
        if (f.From.HasValue) cq = cq.Where(p => p.CompletedAt >= f.From.Value);
        if (f.To.HasValue) cq = cq.Where(p => p.CompletedAt <= f.To.Value);
        if (f.CategoryId.HasValue) cq = cq.Where(p => p.Training.CategoryId == f.CategoryId.Value);
        if (format.HasValue) cq = cq.Where(p => p.Training.TrainingType == format.Value);

        var completions = await cq.CountAsync(cancellationToken);
        dto.ResponseRate = FeedbackAnalytics.Rate(feedbacks.Count, completions);

        return Result.Success(dto);
    }
}
