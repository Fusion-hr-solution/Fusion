using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

/// <summary>US-8.1.3 — admin: persist the drag-reordered question order.</summary>
public record ReorderFeedbackQuestionsCommand(IReadOnlyList<Guid> QuestionIds) : ICommand<Result>;

public class ReorderFeedbackQuestionsCommandHandler
    : ICommandHandler<ReorderFeedbackQuestionsCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderFeedbackQuestionsCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderFeedbackQuestionsCommand request, CancellationToken cancellationToken)
    {
        if (request.QuestionIds.Count == 0)
            return Result.Success();

        var ids = request.QuestionIds.ToList();
        var questions = await _db.FeedbackQuestions
            .Where(q => ids.Contains(q.Id))
            .ToListAsync(cancellationToken);

        for (var i = 0; i < ids.Count; i++)
        {
            var question = questions.FirstOrDefault(q => q.Id == ids[i]);
            question?.Reorder(i);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
