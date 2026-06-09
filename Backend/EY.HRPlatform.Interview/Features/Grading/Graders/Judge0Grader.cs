using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Features.Grading.Judge0;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

public class Judge0Grader(Judge0Client judge0, ILogger<Judge0Grader> logger) : IGrader
{
    private record TestCase(string Input, string ExpectedOutput);

    public bool CanGrade(Question question) =>
        question.Type is QuestionType.Coding or QuestionType.Sql
        && !string.IsNullOrWhiteSpace(question.TestCases);

    public async Task<QuestionGradeResultDto> GradeAsync(Question question, CandidateAnswer answer, CancellationToken ct)
    {
        var testCases = ParseTestCases(question.TestCases!);
        if (testCases.Count == 0)
        {
            return new QuestionGradeResultDto(
                QuestionId: question.Id,
                GraderType: "Judge0",
                Score: 0m,
                MaxScore: question.Points,
                Feedback: "No test cases defined.",
                NeedsHumanReview: true
            );
        }

        var languageId = ResolveLanguageId(question.Language);

        // Submit all test cases concurrently — each is an independent Judge0
        // submission, so there's no reason to wait for one before sending the next.
        var outcomes = await Task.WhenAll(
            testCases.Select(tc => RunTestCaseAsync(question.Id, answer.AnswerText, languageId, tc, ct))
        );
        var passed = outcomes.Count(accepted => accepted);

        var score = testCases.Count == 0 ? 0m : Math.Round((decimal)passed / testCases.Count * question.Points, 2);
        var feedback = $"{passed}/{testCases.Count} test cases passed.";

        return new QuestionGradeResultDto(
            QuestionId: question.Id,
            GraderType: "Judge0",
            Score: score,
            MaxScore: question.Points,
            Feedback: feedback,
            NeedsHumanReview: false
        );
    }

    private async Task<bool> RunTestCaseAsync(
        Guid questionId, string sourceCode, int languageId, TestCase tc, CancellationToken ct)
    {
        try
        {
            var result = await judge0.SubmitAsync(sourceCode, languageId, tc.Input, tc.ExpectedOutput, ct);
            if (result.Accepted)
                return true;

            logger.LogInformation(
                "Judge0 test case not accepted for question {QuestionId}: status={Status} ({StatusId}).",
                questionId, result.StatusDescription, result.StatusId);
            return false;
        }
        catch (Exception ex)
        {
            // Network/timeout/4xx — count as failed test case, but don't hide why.
            logger.LogWarning(ex,
                "Judge0 submission failed for question {QuestionId}; counting test case as failed.",
                questionId);
            return false;
        }
    }

    private static List<TestCase> ParseTestCases(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<TestCase>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static int ResolveLanguageId(string? language) => language?.ToLowerInvariant() switch
    {
        "javascript" or "js" => 63,
        "typescript" or "ts" => 74,
        "python" => 71,
        "java" => 62,
        "csharp" or "c#" => 51,
        "cpp" or "c++" => 54,
        "sql" => 82,
        _ => 71 // default: Python 3
    };
}
