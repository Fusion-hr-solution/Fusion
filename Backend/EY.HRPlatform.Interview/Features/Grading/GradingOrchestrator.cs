using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Features.Grading.Graders;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Grading;

public class GradingOrchestrator(
    AppDbContext dbContext,
    IEnumerable<IGrader> graders,
    ILogger<GradingOrchestrator> logger)
{
    public async Task<GradingResultDto> GradeAttemptAsync(Guid attemptId, CancellationToken ct)
    {
        var attempt = await dbContext.CandidateTestAttempts
            .FirstOrDefaultAsync(a => a.Id == attemptId, ct)
            ?? throw new InvalidOperationException($"Attempt {attemptId} not found.");

        var test = await dbContext.Tests
            .Include(t => t.TestQuestions)
            .FirstOrDefaultAsync(t => t.Id == attempt.TestId, ct)
            ?? throw new InvalidOperationException($"Test {attempt.TestId} not found.");

        var questionIds = test.TestQuestions.Select(tq => tq.QuestionId).ToList();
        var questions = await dbContext.Questions
            .Include(q => q.Options)
            .Where(q => questionIds.Contains(q.Id))
            .ToListAsync(ct);

        var answers = CandidateAnswerParser.Parse(attempt.AnswersJson);

        attempt.GradingStatus = GradingStatus.InProgress;
        await dbContext.SaveChangesAsync(ct);

        // Grade every question concurrently. Graders are stateless and only do
        // HTTP/in-memory work — they never touch the DbContext — so this is safe.
        // Persistence happens sequentially after all grading completes.
        var results = (await Task.WhenAll(
            questions.Select(question => GradeQuestionAsync(question, answers, ct))
        )).ToList();

        foreach (var result in results)
        {
            logger.LogInformation(
                "Question {QuestionId} graded by {Grader}: {Score}/{MaxScore}{Review}.",
                result.QuestionId, result.GraderType, result.Score, result.MaxScore,
                result.NeedsHumanReview ? " (needs human review)" : string.Empty);

            dbContext.QuestionGradeResults.Add(new QuestionGradeResult
            {
                AttemptId = attempt.Id,
                QuestionId = result.QuestionId,
                GraderType = result.GraderType,
                Score = result.Score,
                MaxScore = result.MaxScore,
                Feedback = result.Feedback,
                NeedsHumanReview = result.NeedsHumanReview,
            });
        }

        var totalScore = results.Sum(r => r.Score);
        var maxScore = results.Sum(r => r.MaxScore);
        var hasOpenReviews = results.Any(r => r.NeedsHumanReview);

        attempt.TotalScore = totalScore;
        attempt.MaxScore = maxScore;
        attempt.GradingStatus = hasOpenReviews ? GradingStatus.InProgress : GradingStatus.Completed;

        await dbContext.SaveChangesAsync(ct);

        return new GradingResultDto(
            AttemptId: attempt.Id,
            TotalScore: totalScore,
            MaxScore: maxScore,
            Status: attempt.GradingStatus,
            QuestionResults: results
        );
    }

    /// <summary>
    /// Routes a single question to the right grader and returns its result.
    /// Must not touch the DbContext — it runs concurrently with sibling questions.
    /// </summary>
    private async Task<QuestionGradeResultDto> GradeQuestionAsync(
        Question question,
        IReadOnlyDictionary<string, CandidateAnswer> answers,
        CancellationToken ct)
    {
        if (!answers.TryGetValue(question.Id.ToString(), out var answer))
            answer = CandidateAnswer.Empty;

        // Grader selection (in registration order):
        //   Deterministic → MultipleChoice / TrueFalse
        //   Judge0        → Coding / SQL *with* test cases
        //   Groq (AI)     → Essay / CaseStudy, and Coding / SQL *without* test cases
        // Only a question no grader can handle is routed to human review.
        var grader = graders.FirstOrDefault(g => g.CanGrade(question));
        if (grader is null)
        {
            logger.LogWarning(
                "No grader matched question {QuestionId} (type={Type}); queuing for human review.",
                question.Id, question.Type);
            return new QuestionGradeResultDto(
                QuestionId: question.Id,
                GraderType: "HumanReview",
                Score: 0m,
                MaxScore: question.Points,
                Feedback: null,
                NeedsHumanReview: true
            );
        }

        logger.LogDebug(
            "Grading question {QuestionId} (type={Type}) with {Grader}.",
            question.Id, question.Type, grader.GetType().Name);
        return await grader.GradeAsync(question, answer, ct);
    }
}
