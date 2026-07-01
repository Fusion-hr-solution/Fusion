using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>US-8.1.2 §2 — one trainer's feedback detail: per-training breakdown + comments.</summary>
public record GetTrainerFeedbackDetailQuery(string TrainerKey, DateTime? From, DateTime? To)
    : IQuery<Result<TrainerFeedbackDetailDto>>;

public class GetTrainerFeedbackDetailQueryHandler
    : IQueryHandler<GetTrainerFeedbackDetailQuery, Result<TrainerFeedbackDetailDto>>
{
    private readonly TrainingDbContext _db;

    public GetTrainerFeedbackDetailQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainerFeedbackDetailDto>> Handle(
        GetTrainerFeedbackDetailQuery request, CancellationToken cancellationToken)
    {
        var attributed = (await TrainerFeedbackAttributor.AttributeAsync(
                _db, request.From, request.To, cancellationToken))
            .Where(a => a.TrainerKey == request.TrainerKey)
            .ToList();

        var dto = new TrainerFeedbackDetailDto
        {
            TrainerKey = request.TrainerKey,
            TrainerName = attributed.FirstOrDefault()?.TrainerName ?? request.TrainerKey,
        };

        if (attributed.Count == 0)
            return Result.Success(dto);

        var sessionsByTrainer = await TrainerFeedbackAttributor.SessionsCountByTrainerAsync(_db, cancellationToken);

        dto.SessionsCount = sessionsByTrainer.GetValueOrDefault(request.TrainerKey, 0);
        dto.FeedbackCount = attributed.Count;
        dto.AvgTrainerRating = FeedbackAnalytics.AvgRating(attributed.Select(a => a.TrainerRating));
        dto.RecommendationRate = FeedbackAnalytics.Rate(attributed.Count(a => a.WouldRecommend), attributed.Count);

        dto.Trainings = attributed
            .GroupBy(a => new { a.TrainingId, a.TrainingTitle })
            .Select(g => new TrainerTrainingBreakdownDto
            {
                TrainingId = g.Key.TrainingId,
                TrainingTitle = g.Key.TrainingTitle,
                FeedbackCount = g.Count(),
                AvgTrainerRating = FeedbackAnalytics.AvgRating(g.Select(a => a.TrainerRating)),
            })
            .OrderByDescending(t => t.FeedbackCount)
            .ToList();

        // Comments respect the per-training small-cohort suppression rule: only surface comments
        // from trainings that have at least the threshold number of total feedback responses.
        var trainingIds = attributed.Select(a => a.TrainingId).Distinct().ToList();
        var responseCountByTraining = (await _db.TrainingFeedbacks
                .AsNoTracking()
                .Where(f => trainingIds.Contains(f.TrainingId))
                .GroupBy(f => f.TrainingId)
                .Select(g => new { TrainingId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken))
            .ToDictionary(x => x.TrainingId, x => x.Count);

        var authorIds = attributed
            .Where(a => !a.IsAnonymous && !string.IsNullOrWhiteSpace(a.Comment))
            .Select(a => a.EmployeeId)
            .Distinct()
            .ToList();
        var nameByEmployee = (await _db.EmployeeProfiles
                .AsNoTracking()
                .Where(p => authorIds.Contains(p.EmployeeId) && p.FullName != null)
                .Select(p => new { p.EmployeeId, p.FullName })
                .ToListAsync(cancellationToken))
            .ToDictionary(p => p.EmployeeId, p => p.FullName!);

        dto.Comments = attributed
            .Where(a => !string.IsNullOrWhiteSpace(a.Comment)
                && responseCountByTraining.GetValueOrDefault(a.TrainingId, 0) >= FeedbackAnalytics.CommentSuppressionThreshold)
            .OrderByDescending(a => a.SubmittedAt)
            .Select(a => new FeedbackCommentDto
            {
                Author = a.IsAnonymous ? "Anonymous" : nameByEmployee.GetValueOrDefault(a.EmployeeId, "Employee"),
                Comment = a.Comment!,
                OverallRating = a.OverallRating,
                SubmittedAt = a.SubmittedAt,
                TrainingTitle = a.TrainingTitle,
            })
            .ToList();

        return Result.Success(dto);
    }
}
