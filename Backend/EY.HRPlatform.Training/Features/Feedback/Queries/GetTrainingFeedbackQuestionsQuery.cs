using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Queries;

/// <summary>
/// US-8.1.3 — learner: the active custom questions to render on a training's feedback form
/// (the default form + the training's category form), ordered default-first then by position.
/// </summary>
public record GetTrainingFeedbackQuestionsQuery(Guid TrainingId) : IQuery<Result<List<FeedbackQuestionDto>>>;

public class GetTrainingFeedbackQuestionsQueryHandler
    : IQueryHandler<GetTrainingFeedbackQuestionsQuery, Result<List<FeedbackQuestionDto>>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingFeedbackQuestionsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<FeedbackQuestionDto>>> Handle(
        GetTrainingFeedbackQuestionsQuery request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .AsNoTracking()
            .Where(t => t.Id == request.TrainingId)
            .Select(t => new { t.CategoryId })
            .FirstOrDefaultAsync(cancellationToken);

        // Unknown training → no form (rather than silently returning the default-form questions).
        if (training is null)
            return Result.Success(new List<FeedbackQuestionDto>());

        var categoryId = (Guid?)training.CategoryId;

        var questions = await _db.FeedbackQuestions
            .AsNoTracking()
            .Where(q => !q.IsRetired && (q.CategoryId == null || q.CategoryId == categoryId))
            .ToListAsync(cancellationToken);

        var ordered = questions
            .OrderBy(q => q.CategoryId.HasValue) // default-form (null) first
            .ThenBy(q => q.Order)
            .Select(q => new FeedbackQuestionDto
            {
                Id = q.Id,
                CategoryId = q.CategoryId,
                Type = q.Type.ToString(),
                Label = q.Label,
                Order = q.Order,
                Options = q.Options,
            })
            .ToList();

        return Result.Success(ordered);
    }
}
