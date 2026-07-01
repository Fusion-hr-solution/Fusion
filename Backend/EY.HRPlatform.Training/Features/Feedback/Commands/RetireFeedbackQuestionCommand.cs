using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

/// <summary>US-8.1.3 — admin: soft-retire a custom question (append-only; never hard-deleted so
/// historical answers stay interpretable — ADR 0006).</summary>
public record RetireFeedbackQuestionCommand(Guid Id) : ICommand<Result>;

public class RetireFeedbackQuestionCommandHandler
    : ICommandHandler<RetireFeedbackQuestionCommand, Result>
{
    private readonly TrainingDbContext _db;

    public RetireFeedbackQuestionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(RetireFeedbackQuestionCommand request, CancellationToken cancellationToken)
    {
        var question = await _db.FeedbackQuestions
            .FirstOrDefaultAsync(q => q.Id == request.Id && !q.IsRetired, cancellationToken);

        if (question is null)
            return Result.Failure(Error.NotFound("FeedbackQuestion", request.Id));

        question.Retire();
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
