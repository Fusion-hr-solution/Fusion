using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>US-8.1.2 §2 — per-trainer feedback list (single-trainer attribution, ADR 0006).</summary>
public record GetTrainerFeedbackSummaryQuery(DateTime? From, DateTime? To)
    : IQuery<Result<List<TrainerFeedbackListItemDto>>>;

public class GetTrainerFeedbackSummaryQueryHandler
    : IQueryHandler<GetTrainerFeedbackSummaryQuery, Result<List<TrainerFeedbackListItemDto>>>
{
    private readonly TrainingDbContext _db;

    public GetTrainerFeedbackSummaryQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainerFeedbackListItemDto>>> Handle(
        GetTrainerFeedbackSummaryQuery request, CancellationToken cancellationToken)
    {
        var attributed = await TrainerFeedbackAttributor.AttributeAsync(
            _db, request.From, request.To, cancellationToken);

        if (attributed.Count == 0)
            return Result.Success(new List<TrainerFeedbackListItemDto>());

        var sessionsByTrainer = await TrainerFeedbackAttributor.SessionsCountByTrainerAsync(_db, cancellationToken);

        var list = attributed
            .GroupBy(a => a.TrainerKey)
            .Select(g => new TrainerFeedbackListItemDto
            {
                TrainerKey = g.Key,
                TrainerName = g.First().TrainerName,
                FeedbackCount = g.Count(),
                AvgTrainerRating = FeedbackAnalytics.AvgRating(g.Select(a => a.TrainerRating)),
                RecommendationRate = FeedbackAnalytics.Rate(g.Count(a => a.WouldRecommend), g.Count()),
                SessionsCount = sessionsByTrainer.GetValueOrDefault(g.Key, 0),
            })
            .OrderByDescending(t => t.AvgTrainerRating)
            .ThenByDescending(t => t.FeedbackCount)
            .ToList();

        return Result.Success(list);
    }
}
