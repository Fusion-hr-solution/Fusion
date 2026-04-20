using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateExamQuestionCommandHandler : ICommandHandler<UpdateExamQuestionCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateExamQuestionCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateExamQuestionCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.QuestionText))
            return Result.Failure(Error.Validation("Question.TextRequired", "Question text is required."));

        if (!Enum.TryParse<QuestionType>(request.Type, true, out var questionType))
            return Result.Failure(Error.Validation("Question.InvalidType",
                $"Invalid question type '{request.Type}'. Valid values: SingleChoice, MultipleChoice, TrueFalse."));

        if (request.Options is null || request.Options.Count < 2)
            return Result.Failure(Error.Validation("Question.OptionsRequired", "At least two options are required."));

        if (!request.Options.Any(o => o.IsCorrect))
            return Result.Failure(Error.Validation("Question.NoCorrectOption", "At least one option must be marked correct."));

        if (questionType == QuestionType.SingleChoice && request.Options.Count(o => o.IsCorrect) != 1)
            return Result.Failure(Error.Validation("Question.SingleChoiceCorrectCount",
                "Single-choice questions must have exactly one correct option."));

        if (questionType == QuestionType.TrueFalse && request.Options.Count != 2)
            return Result.Failure(Error.Validation("Question.TrueFalseOptionCount",
                "True/false questions must have exactly two options."));

        var question = await _db.ExamQuestions
            .Include(q => q.Exam)
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == request.QuestionId
                                   && q.ExamId == request.ExamId
                                   && q.Exam.TrainingId == request.TrainingId, cancellationToken);

        if (question is null)
            return Result.Failure(Error.NotFound("ExamQuestion", request.QuestionId));

        question.Update(request.QuestionText, questionType, request.Points);

        // Replace options wholesale. Materialize first so the navigation collection
        // is not modified while EF tracks the removals (avoids double-delete via
        // relationship fixup which causes DbUpdateConcurrencyException).
        _db.ExamOptions.RemoveRange(question.Options.ToList());

        for (var i = 0; i < request.Options.Count; i++)
        {
            var opt = request.Options[i];
            _db.ExamOptions.Add(new ExamOption(opt.OptionText, opt.IsCorrect, question.Id, i));
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
