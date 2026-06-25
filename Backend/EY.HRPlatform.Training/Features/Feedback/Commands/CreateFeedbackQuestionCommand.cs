using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

/// <summary>US-8.1.3 — admin: append a custom question to a category's form (or the default form).</summary>
public record CreateFeedbackQuestionCommand(Guid? CategoryId, string Type, string Label, string? Options)
    : ICommand<Result<Guid>>;

public class CreateFeedbackQuestionCommandHandler
    : ICommandHandler<CreateFeedbackQuestionCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateFeedbackQuestionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateFeedbackQuestionCommand request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<FeedbackQuestionType>(request.Type, ignoreCase: true, out var type))
            return Result.Failure<Guid>(Error.Validation("Feedback.InvalidQuestionType", "Unknown question type."));

        if (string.IsNullOrWhiteSpace(request.Label))
            return Result.Failure<Guid>(Error.Validation("Feedback.QuestionLabelRequired", "A question label is required."));

        var nextOrder = await _db.FeedbackQuestions
            .Where(q => !q.IsRetired && q.CategoryId == request.CategoryId)
            .CountAsync(cancellationToken);

        var question = new FeedbackQuestion(request.CategoryId, type, request.Label.Trim(), nextOrder, request.Options);
        _db.FeedbackQuestions.Add(question);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(question.Id);
    }
}
