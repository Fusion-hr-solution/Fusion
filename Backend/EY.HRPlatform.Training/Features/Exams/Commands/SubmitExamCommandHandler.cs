using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Exams.Commands;

public class SubmitExamCommandHandler : ICommandHandler<SubmitExamCommand, Result<ExamSubmissionResultDto>>
{
    private readonly TrainingDbContext _db;

    public SubmitExamCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<ExamSubmissionResultDto>> Handle(SubmitExamCommand request, CancellationToken cancellationToken)
    {
        // Enrollment check
        var assignment = await _db.Assignments
            .FirstOrDefaultAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId, cancellationToken);

        if (assignment is null)
            return Result.Failure<ExamSubmissionResultDto>(new Error("Enrollment.NotFound", "You are not enrolled in this training."));

        // Eligibility check: all chapters completed
        var eligibility = await ExamEligibility.EvaluateAsync(_db, request.EmployeeId, request.TrainingId, cancellationToken);
        if (!eligibility.AllChaptersCompleted)
            return Result.Failure<ExamSubmissionResultDto>(new Error("Exam.Locked",
                "The exam is locked. Complete all chapters first."));

        // Load exam with questions + options
        var exam = await _db.Exams
            .Include(e => e.Questions)
                .ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(e => e.TrainingId == request.TrainingId, cancellationToken);

        if (exam is null)
            return Result.Failure<ExamSubmissionResultDto>(Error.NotFound("Exam for training", request.TrainingId));

        if (exam.Questions.Count == 0)
            return Result.Failure<ExamSubmissionResultDto>(new Error("Exam.Empty", "This exam has no questions yet."));

        // Grade
        var totalPoints = exam.Questions.Sum(q => q.Points);
        var earnedPoints = 0;
        var correctCount = 0;

        var answersByQuestion = request.Answers
            .GroupBy(a => a.QuestionId)
            .ToDictionary(g => g.Key, g => g.Last().SelectedOptionIds ?? new List<Guid>());

        foreach (var question in exam.Questions)
        {
            var correctOptionIds = question.Options
                .Where(o => o.IsCorrect)
                .Select(o => o.Id)
                .ToHashSet();

            var selected = answersByQuestion.TryGetValue(question.Id, out var s)
                ? s.ToHashSet()
                : new HashSet<Guid>();

            // Must select exactly the correct option set to earn points (no partial credit).
            var isCorrect = selected.SetEquals(correctOptionIds) && selected.Count > 0;
            if (isCorrect)
            {
                earnedPoints += question.Points;
                correctCount++;
            }
        }

        var score = totalPoints > 0 ? (int)Math.Round(earnedPoints * 100.0 / totalPoints) : 0;
        var passed = score >= exam.PassingScore;

        var attempt = new ExamAttempt(
            request.EmployeeId,
            exam.Id,
            assignment.Id,
            request.TrainingId,
            score,
            exam.Questions.Count,
            correctCount,
            passed);

        _db.ExamAttempts.Add(attempt);

        // If passed, mark the training as completed.
        var trainingCompleted = false;
        if (passed)
        {
            var progress = await _db.TrainingProgress
                .FirstOrDefaultAsync(p => p.EmployeeId == request.EmployeeId && p.TrainingId == request.TrainingId, cancellationToken);

            if (progress is null)
            {
                progress = new TrainingProgress(request.EmployeeId, request.TrainingId);
                _db.TrainingProgress.Add(progress);
                progress.Start();
            }

            if (progress.Status != TrainingStatus.Completed)
            {
                progress.Complete();
            }

            trainingCompleted = true;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(new ExamSubmissionResultDto
        {
            AttemptId = attempt.Id,
            Score = score,
            PassingScore = exam.PassingScore,
            TotalQuestions = exam.Questions.Count,
            CorrectAnswers = correctCount,
            Passed = passed,
            AttemptedAt = attempt.AttemptedAt,
            TrainingCompleted = trainingCompleted
        });
    }
}
