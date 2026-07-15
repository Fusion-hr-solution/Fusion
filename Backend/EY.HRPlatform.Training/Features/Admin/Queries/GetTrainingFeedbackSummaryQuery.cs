using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>US-8.1.2 §1 — per-training feedback summary (ratings, distribution, trend, comments).</summary>
public record GetTrainingFeedbackSummaryQuery(Guid TrainingId, DateTime? From, DateTime? To)
    : IQuery<Result<TrainingFeedbackSummaryDto>>;

public class GetTrainingFeedbackSummaryQueryHandler
    : IQueryHandler<GetTrainingFeedbackSummaryQuery, Result<TrainingFeedbackSummaryDto>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingFeedbackSummaryQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainingFeedbackSummaryDto>> Handle(
        GetTrainingFeedbackSummaryQuery request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .AsNoTracking()
            .Where(t => t.Id == request.TrainingId)
            .Select(t => new { t.Id, t.Title })
            .FirstOrDefaultAsync(cancellationToken);

        if (training is null)
            return Result.Failure<TrainingFeedbackSummaryDto>(Error.NotFound("Training", request.TrainingId));

        var fq = _db.TrainingFeedbacks.AsNoTracking().Where(f => f.TrainingId == request.TrainingId);
        if (request.From.HasValue) fq = fq.Where(f => f.SubmittedAt >= request.From.Value);
        if (request.To.HasValue) fq = fq.Where(f => f.SubmittedAt <= request.To.Value);

        var feedbacks = await fq
            .Select(f => new
            {
                f.EmployeeId,
                f.OverallRating,
                f.ContentRating,
                f.RelevanceRating,
                f.TrainerRating,
                f.WouldRecommend,
                f.Comment,
                f.IsAnonymous,
                f.SubmittedAt,
            })
            .ToListAsync(cancellationToken);

        var dto = new TrainingFeedbackSummaryDto
        {
            TrainingId = training.Id,
            TrainingTitle = training.Title,
            TotalResponses = feedbacks.Count,
        };

        if (feedbacks.Count == 0)
            return Result.Success(dto);

        dto.AvgOverallRating = FeedbackAnalytics.AvgRating(feedbacks.Select(f => f.OverallRating));
        dto.AvgContentRating = FeedbackAnalytics.AvgRating(feedbacks.Select(f => f.ContentRating));
        dto.AvgRelevanceRating = FeedbackAnalytics.AvgRating(feedbacks.Select(f => f.RelevanceRating));

        var trainerRatings = feedbacks.Where(f => f.TrainerRating.HasValue).Select(f => f.TrainerRating!.Value).ToList();
        dto.AvgTrainerRating = trainerRatings.Count > 0 ? FeedbackAnalytics.AvgRating(trainerRatings) : null;

        dto.RecommendationRate = FeedbackAnalytics.Rate(feedbacks.Count(f => f.WouldRecommend), feedbacks.Count);
        dto.RatingDistribution = FeedbackAnalytics.Distribution(feedbacks.Select(f => f.OverallRating));
        dto.MonthlyTrend = FeedbackAnalytics.MonthlyTrend(feedbacks.Select(f => (f.SubmittedAt, f.OverallRating)));

        // Comments are suppressed for small cohorts to prevent de-anonymisation by inference.
        if (feedbacks.Count < FeedbackAnalytics.CommentSuppressionThreshold)
        {
            dto.CommentsSuppressed = true;
            return Result.Success(dto);
        }

        var commented = feedbacks.Where(f => !string.IsNullOrWhiteSpace(f.Comment)).ToList();
        var authorIds = commented.Where(f => !f.IsAnonymous).Select(f => f.EmployeeId).Distinct().ToList();
        var nameByEmployee = (await _db.EmployeeProfiles
                .AsNoTracking()
                .Where(p => authorIds.Contains(p.EmployeeId) && p.FullName != null)
                .Select(p => new { p.EmployeeId, p.FullName })
                .ToListAsync(cancellationToken))
            .ToDictionary(p => p.EmployeeId, p => p.FullName!);

        dto.Comments = commented
            .OrderByDescending(f => f.SubmittedAt)
            .Select(f => new FeedbackCommentDto
            {
                Author = f.IsAnonymous
                    ? "Anonymous"
                    : nameByEmployee.GetValueOrDefault(f.EmployeeId, "Employee"),
                Comment = f.Comment!,
                OverallRating = f.OverallRating,
                SubmittedAt = f.SubmittedAt,
            })
            .ToList();

        return Result.Success(dto);
    }
}
