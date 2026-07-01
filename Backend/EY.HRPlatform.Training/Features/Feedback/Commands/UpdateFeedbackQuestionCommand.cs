using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

/// <summary>US-8.1.3 — admin: edit a custom question's label/options (type is immutable per ADR 0006).</summary>
public record UpdateFeedbackQuestionCommand(Guid Id, string Label, string? Options) : ICommand<Result>;

public class UpdateFeedbackQuestionCommandHandler
    : ICommandHandler<UpdateFeedbackQuestionCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateFeedbackQuestionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateFeedbackQuestionCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Label))
            return Result.Failure(Error.Validation("Feedback.QuestionLabelRequired", "A question label is required."));

        var question = await _db.FeedbackQuestions
            .FirstOrDefaultAsync(q => q.Id == request.Id && !q.IsRetired, cancellationToken);

        if (question is null)
            return Result.Failure(Error.NotFound("FeedbackQuestion", request.Id));

        question.Update(request.Label.Trim(), request.Options);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
