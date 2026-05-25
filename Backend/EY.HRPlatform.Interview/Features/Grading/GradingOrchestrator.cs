using System.Text.Json;
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

        var answers = ParseAnswers(attempt.AnswersJson);

        attempt.GradingStatus = GradingStatus.InProgress;
        await dbContext.SaveChangesAsync(ct);

        var results = new List<QuestionGradeResultDto>();

        foreach (var question in questions)
        {
            answers.TryGetValue(question.Id.ToString(), out var answer);
            answer ??= string.Empty;

            var grader = graders.FirstOrDefault(g => g.CanGrade(question));

            QuestionGradeResultDto result;
            if (grader is null)
            {
                logger.LogDebug("No grader for question {QuestionId} (type={Type}); queuing for human review.", question.Id, question.Type);
                result = new QuestionGradeResultDto(
                    QuestionId: question.Id,
                    GraderType: "HumanReview",
                    Score: 0m,
                    MaxScore: question.Points,
                    Feedback: null,
                    NeedsHumanReview: true
                );
            }
            else
            {
                result = await grader.GradeAsync(question, answer, ct);
            }

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

            results.Add(result);
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

    private static Dictionary<string, string> ParseAnswers(string answersJson)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
