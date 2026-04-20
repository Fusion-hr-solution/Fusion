using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class AddExamQuestionCommandHandler : ICommandHandler<AddExamQuestionCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AddExamQuestionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AddExamQuestionCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.QuestionText))
            return Result.Failure<Guid>(Error.Validation("Question.TextRequired", "Question text is required."));

        if (!Enum.TryParse<QuestionType>(request.Type, true, out var questionType))
            return Result.Failure<Guid>(Error.Validation("Question.InvalidType",
                $"Invalid question type '{request.Type}'. Valid values: SingleChoice, MultipleChoice, TrueFalse."));

        if (request.Options is null || request.Options.Count < 2)
            return Result.Failure<Guid>(Error.Validation("Question.OptionsRequired", "At least two options are required."));

        if (!request.Options.Any(o => o.IsCorrect))
            return Result.Failure<Guid>(Error.Validation("Question.NoCorrectOption", "At least one option must be marked correct."));

        if (questionType == QuestionType.SingleChoice && request.Options.Count(o => o.IsCorrect) != 1)
            return Result.Failure<Guid>(Error.Validation("Question.SingleChoiceCorrectCount",
                "Single-choice questions must have exactly one correct option."));

        if (questionType == QuestionType.TrueFalse && request.Options.Count != 2)
            return Result.Failure<Guid>(Error.Validation("Question.TrueFalseOptionCount",
                "True/false questions must have exactly two options."));

        var exam = await _db.Exams
            .FirstOrDefaultAsync(e => e.Id == request.ExamId && e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure<Guid>(Error.NotFound("Exam", request.ExamId));

        var maxIndex = await _db.ExamQuestions
            .Where(q => q.ExamId == request.ExamId)
            .MaxAsync(q => (int?)q.OrderIndex, cancellationToken) ?? -1;

        var question = new ExamQuestion(request.QuestionText, questionType, request.ExamId, maxIndex + 1, request.Points);

        for (var i = 0; i < request.Options.Count; i++)
        {
            var opt = request.Options[i];
            question.AddOption(new ExamOption(opt.OptionText, opt.IsCorrect, question.Id, i));
        }

        _db.ExamQuestions.Add(question);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(question.Id);
    }
}
