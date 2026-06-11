using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Exams.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Exams;

public class SubmitExamCommandHandlerTests
{
    // -----------------------------------------------------------------
    // Scenario container
    // -----------------------------------------------------------------

    private sealed record ExamScenario(
        TrainingDbContext Db,
        Guid EmployeeId,
        Guid TrainingId,
        Exam Exam,
        TrainingAssignment Assignment) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync() => await Db.DisposeAsync();
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// <summary>Creates a training with all chapters completed and an exam attached.</summary>
    private static async Task<ExamScenario> ArrangeExamScenarioAsync(int passingScore = 60)
    {
        var db = await TestDbContextFactory.CreateWithSeedDataAsync();

        var training = db.Trainings.Include(t => t.Chapters).First();
        var trainingId = training.Id;
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(trainingId, employeeId, AssignmentType.SelfEnroll);
        db.Assignments.Add(assignment);

        // Mark all chapters completed so the exam is unlocked.
        var chapterIds = await db.Chapters.Where(c => c.TrainingId == trainingId).Select(c => c.Id).ToListAsync();
        foreach (var chapterId in chapterIds)
        {
            var cp = new ChapterProgress(employeeId, chapterId);
            cp.MarkCompleted();
            db.ChapterProgress.Add(cp);
        }

        var exam = new Exam("Final Exam", passingScore, trainingId);
        db.Exams.Add(exam);
        await db.SaveChangesAsync();

        return new ExamScenario(db, employeeId, trainingId, exam, assignment);
    }

    /// <summary>Adds a single-choice question with one correct option to the exam.</summary>
    private static async Task<(ExamQuestion question, ExamOption correctOption)>
        AddSingleChoiceQuestionAsync(TrainingDbContext db, Guid examId, int orderIndex, int points = 10)
    {
        var question = new ExamQuestion("What is 2+2?", QuestionType.SingleChoice, examId, orderIndex, points);
        db.ExamQuestions.Add(question);
        await db.SaveChangesAsync();

        var correct = new ExamOption("4", true, question.Id, 0);
        var wrong = new ExamOption("5", false, question.Id, 1);
        db.ExamOptions.Add(correct);
        db.ExamOptions.Add(wrong);
        await db.SaveChangesAsync();

        return (question, correct);
    }

    /// <summary>Adds a multiple-choice question with two correct options to the exam.</summary>
    private static async Task<(ExamQuestion question, ExamOption correct1, ExamOption correct2, ExamOption wrong)>
        AddMultipleChoiceQuestionAsync(TrainingDbContext db, Guid examId, int orderIndex, int points = 10)
    {
        var question = new ExamQuestion("Select all even numbers", QuestionType.MultipleChoice, examId, orderIndex, points);
        db.ExamQuestions.Add(question);
        await db.SaveChangesAsync();

        var c1 = new ExamOption("2", true, question.Id, 0);
        var c2 = new ExamOption("4", true, question.Id, 1);
        var w = new ExamOption("3", false, question.Id, 2);
        db.ExamOptions.AddRange(c1, c2, w);
        await db.SaveChangesAsync();

        return (question, c1, c2, w);
    }

    // -----------------------------------------------------------------
    // Enrollment / eligibility gates
    // -----------------------------------------------------------------

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotEnrolled()
    {
        await using var db = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = db.Trainings.First();
        var handler = new SubmitExamCommandHandler(db, NoOpCertificateIssuanceService.Instance);

        var result = await handler.Handle(
            new SubmitExamCommand(Guid.NewGuid(), training.Id, []),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChaptersNotCompleted()
    {
        await using var db = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = db.Trainings.First();
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        db.Assignments.Add(assignment);
        // Create exam but do NOT mark chapters completed.
        db.Exams.Add(new Exam("Locked Exam", 60, training.Id));
        await db.SaveChangesAsync();

        var handler = new SubmitExamCommandHandler(db, NoOpCertificateIssuanceService.Instance);

        var result = await handler.Handle(
            new SubmitExamCommand(employeeId, training.Id, []),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Exam.Locked", result.Error.Code);
    }

    // -----------------------------------------------------------------
    // Scoring: single-choice
    // -----------------------------------------------------------------

    [Fact]
    public async Task Handle_ReturnsScore100_WhenAllSingleChoiceCorrect()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, correctOpt) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer> { new(q.Id, [correctOpt.Id]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(100, result.Value!.Score);
        Assert.True(result.Value.Passed);
        Assert.Equal(1, result.Value.CorrectAnswers);
    }

    [Fact]
    public async Task Handle_ReturnsScore0_WhenAllAnswersWrong()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, _) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer> { new(q.Id, [Guid.NewGuid()]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value!.Score);
        Assert.False(result.Value.Passed);
        Assert.Equal(0, result.Value.CorrectAnswers);
    }

    [Fact]
    public async Task Handle_CalculatesPartialScore_WhenSomeQuestionsCorrect()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q1, correct1) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);
        var (q2, _) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 1, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer>
        {
            new(q1.Id, [correct1.Id]),   // correct
            new(q2.Id, [Guid.NewGuid()]) // wrong
        };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(50, result.Value!.Score);
        Assert.False(result.Value.Passed); // 50 < 60
        Assert.Equal(1, result.Value.CorrectAnswers);
    }

    // -----------------------------------------------------------------
    // Scoring: multiple-choice (all-or-nothing)
    // -----------------------------------------------------------------

    [Fact]
    public async Task Handle_MultipleChoice_IsWrong_WhenOnlyPartialCorrectSelected()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, c1, _, _) = await AddMultipleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        // Select only ONE of the two correct options — partial selection earns 0 points.
        var answers = new List<SubmitExamAnswer> { new(q.Id, [c1.Id]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value!.Score);
        Assert.False(result.Value.Passed);
    }

    [Fact]
    public async Task Handle_MultipleChoice_IsCorrect_WhenAllCorrectOptionsSelected()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, c1, c2, _) = await AddMultipleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer> { new(q.Id, [c1.Id, c2.Id]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(100, result.Value!.Score);
        Assert.True(result.Value.Passed);
    }

    // -----------------------------------------------------------------
    // Training completion gate
    // -----------------------------------------------------------------

    [Fact]
    public async Task Handle_CompletesTraining_WhenPassed()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, correctOpt) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer> { new(q.Id, [correctOpt.Id]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.Passed);

        var progress = await s.Db.TrainingProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == s.EmployeeId && p.TrainingId == s.TrainingId);
        Assert.NotNull(progress);
        Assert.Equal(TrainingStatus.Completed, progress.Status);
    }

    [Fact]
    public async Task Handle_DoesNotCompleteTraining_WhenFailed()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, _) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer> { new(q.Id, [Guid.NewGuid()]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Passed);

        var progress = await s.Db.TrainingProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == s.EmployeeId && p.TrainingId == s.TrainingId);
        Assert.True(progress is null || progress.Status != TrainingStatus.Completed);
    }

    [Fact]
    public async Task Handle_PersistsAttemptRecord()
    {
        await using var s = await ArrangeExamScenarioAsync(passingScore: 60);
        var (q, correctOpt) = await AddSingleChoiceQuestionAsync(s.Db, s.Exam.Id, 0, points: 10);

        var handler = new SubmitExamCommandHandler(s.Db, NoOpCertificateIssuanceService.Instance);
        var answers = new List<SubmitExamAnswer> { new(q.Id, [correctOpt.Id]) };

        var result = await handler.Handle(
            new SubmitExamCommand(s.EmployeeId, s.TrainingId, answers),
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var attempt = await s.Db.ExamAttempts.FirstOrDefaultAsync(a => a.Id == result.Value!.AttemptId);
        Assert.NotNull(attempt);
        Assert.Equal(s.EmployeeId, attempt.EmployeeId);
        Assert.Equal(s.TrainingId, attempt.TrainingId);
        Assert.Equal(100, attempt.Score);
        Assert.True(attempt.Passed);
    }
}
