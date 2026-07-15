using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Queries;

/// <summary>US-8.1.3 — admin: active custom questions for a category (null = default form).</summary>
public record GetFeedbackQuestionsQuery(Guid? CategoryId) : IQuery<Result<List<FeedbackQuestionDto>>>;

public class GetFeedbackQuestionsQueryHandler
    : IQueryHandler<GetFeedbackQuestionsQuery, Result<List<FeedbackQuestionDto>>>
{
    private readonly TrainingDbContext _db;

    public GetFeedbackQuestionsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<FeedbackQuestionDto>>> Handle(
        GetFeedbackQuestionsQuery request, CancellationToken cancellationToken)
    {
        var questions = await _db.FeedbackQuestions
            .AsNoTracking()
            .Where(q => !q.IsRetired && q.CategoryId == request.CategoryId)
            .OrderBy(q => q.Order)
            .Select(q => new FeedbackQuestionDto
            {
                Id = q.Id,
                CategoryId = q.CategoryId,
                Type = q.Type.ToString(),
                Label = q.Label,
                Order = q.Order,
                Options = q.Options,
            })
            .ToListAsync(cancellationToken);

        return Result.Success(questions);
    }
}
