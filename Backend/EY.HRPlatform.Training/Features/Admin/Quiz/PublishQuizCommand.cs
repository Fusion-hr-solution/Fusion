using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// US-8.2.5 — publish a reviewed quiz draft into the training's exam (ADR 0009). Get-or-creates the
/// single exam for the training, appends the questions (with explanations), then clears the draft —
/// all in one transaction. Validation mirrors <c>AddExamQuestionCommand</c> so published questions are
/// indistinguishable from hand-authored ones.
/// </summary>
public record PublishQuizCommand(Guid TrainingId, IReadOnlyList<QuizQuestionInput> Questions, Guid EmployeeId)
    : ICommand<Result<QuizPublishResultDto>>;

public class PublishQuizCommandHandler : ICommandHandler<PublishQuizCommand, Result<QuizPublishResultDto>>
{
    private const int DefaultPassingScore = 70;

    // ExamQuestion.QuestionText is varchar(1000); the draft allows more, so cap on the way into the exam.
    private const int MaxQuestionTextLength = 1000;

    private readonly TrainingDbContext _db;

    public PublishQuizCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<QuizPublishResultDto>> Handle(PublishQuizCommand request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId && !t.IsDeleted, cancellationToken);
        if (training is null)
            return Result.Failure<QuizPublishResultDto>(Error.NotFound("Training", request.TrainingId));

        if (request.Questions is null || request.Questions.Count == 0)
            return Result.Failure<QuizPublishResultDto>(Error.Validation(
                "Quiz.NoQuestions", "There are no questions to publish."));

        // Validate every question up front so the publish is atomic — a single bad question fails the batch.
        var prepared = new List<(QuizQuestionInput Question, QuestionType Type)>();
        for (var i = 0; i < request.Questions.Count; i++)
        {
            var error = Validate(request.Questions[i], i, out var type);
            if (error is not null)
                return Result.Failure<QuizPublishResultDto>(error);
            prepared.Add((request.Questions[i], type));
        }

        // Get-or-create the single exam for the training (FKs are valid pre-save: ctor-generated Ids).
        var exam = await _db.Exams.FirstOrDefaultAsync(e => e.TrainingId == request.TrainingId, cancellationToken);
        if (exam is null)
        {
            exam = new Exam(training.Title, DefaultPassingScore, request.TrainingId);
            _db.Exams.Add(exam);
        }

        var nextOrder = await _db.ExamQuestions
            .Where(q => q.ExamId == exam.Id)
            .MaxAsync(q => (int?)q.OrderIndex, cancellationToken) ?? -1;
        nextOrder++;

        foreach (var (q, type) in prepared)
        {
            var explanation = string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation.Trim();
            var question = new ExamQuestion(q.Text.Trim(), type, exam.Id, nextOrder++, q.Points < 1 ? 1 : q.Points, explanation);

            var optionOrder = 0;
            foreach (var o in q.Options)
                question.AddOption(new ExamOption(o.Text.Trim(), o.IsCorrect, question.Id, optionOrder++));

            _db.ExamQuestions.Add(question);
        }

        // Clear the draft — it has served its purpose.
        var draft = await _db.QuizDrafts.FirstOrDefaultAsync(d => d.TrainingId == request.TrainingId, cancellationToken);
        if (draft is not null)
            _db.QuizDrafts.Remove(draft);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Lost a race against a concurrent publish (unique Exam.TrainingId / ExamQuestion OrderIndex).
            return Result.Failure<QuizPublishResultDto>(Error.Validation(
                "Quiz.PublishConflict", "The exam changed while publishing. Please review it and try again."));
        }

        return Result.Success(new QuizPublishResultDto { ExamId = exam.Id, PublishedCount = prepared.Count });
    }

    /// <summary>Per-question rules identical to AddExamQuestion, surfaced with the offending question's number.</summary>
    private static Error? Validate(QuizQuestionInput q, int index, out QuestionType type)
    {
        type = QuestionType.SingleChoice;
        var n = index + 1;

        if (string.IsNullOrWhiteSpace(q.Text))
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: text is required.");

        if (q.Text.Trim().Length > MaxQuestionTextLength)
            return Error.Validation("Quiz.InvalidQuestion",
                $"Question {n}: text must be {MaxQuestionTextLength} characters or fewer.");

        if (!Enum.TryParse(q.Type, true, out type) || !Enum.IsDefined(type))
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: invalid type '{q.Type}'.");

        var options = q.Options ?? [];
        if (options.Count < 2)
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: at least two options are required.");

        if (options.Any(o => string.IsNullOrWhiteSpace(o.Text)))
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: every option needs text.");

        var correct = options.Count(o => o.IsCorrect);
        if (correct < 1)
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: mark at least one option correct.");

        if (type == QuestionType.SingleChoice && correct != 1)
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: single-choice must have exactly one correct option.");

        if (type == QuestionType.TrueFalse && options.Count != 2)
            return Error.Validation("Quiz.InvalidQuestion", $"Question {n}: true/false must have exactly two options.");

        return null;
    }
}
