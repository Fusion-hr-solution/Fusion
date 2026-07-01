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

        var languageId = Judge0LanguageMap.ResolveForQuestion(question.Type, question.Language);

        // Multi-file question: the candidate's answer is the project JSON. Package it ONCE and
        // reuse the zip across every test case (only stdin/expected differ). Falls back to
        // treating the answer as single-file source if it isn't a valid project.
        var sourceCode = answer.AnswerText;
        string? additionalFiles = null;
        if (!string.IsNullOrWhiteSpace(question.ProjectFiles))
        {
            var project = ParseProjectAnswer(answer.AnswerText);
            if (project is not null)
            {
                try
                {
                    var built = Judge0ProjectBuilder.Build(project.Files, project.Entry);
                    sourceCode = built.EntryContent;
                    additionalFiles = built.AdditionalFilesBase64;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Invalid multi-file answer for question {QuestionId}; grading as-is.", question.Id);
                }
            }
        }

        // Submit all test cases concurrently — each is an independent Judge0
        // submission, so there's no reason to wait for one before sending the next.
        var outcomes = await Task.WhenAll(
            testCases.Select(tc => RunTestCaseAsync(question.Id, sourceCode, languageId, tc, additionalFiles, ct))
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
        Guid questionId, string sourceCode, int languageId, TestCase tc, string? additionalFiles, CancellationToken ct)
    {
        try
        {
            // Run WITHOUT expected_output and compare ourselves, so trailing whitespace /
            // newlines (e.g. print() appending "\n") don't cause false failures the way
            // Judge0's strict exact-match comparison would.
            var result = await judge0.SubmitAsync(
                sourceCode, languageId, tc.Input, expectedOutput: null, ct, additionalFilesBase64: additionalFiles);

            // StatusId 3 = ran to completion; anything else is compile/runtime/timeout error.
            if (result.StatusId != 3)
            {
                logger.LogInformation(
                    "Judge0 test case did not run cleanly for question {QuestionId}: status={Status} ({StatusId}).",
                    questionId, result.StatusDescription, result.StatusId);
                return false;
            }

            var passed = NormalizeOutput(result.Stdout) == NormalizeOutput(tc.ExpectedOutput);
            if (!passed)
            {
                logger.LogInformation(
                    "Judge0 output did not match expected for question {QuestionId}.", questionId);
            }

            return passed;
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

    /// <summary>Normalizes program output for comparison: unifies line endings, strips trailing
    /// whitespace on each line, and drops trailing blank lines — so a missing/extra trailing
    /// newline (the most common false failure) doesn't fail an otherwise-correct answer.</summary>
    private static string NormalizeOutput(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        var lines = value.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n')
            .Select(line => line.TrimEnd());

        return string.Join('\n', lines).TrimEnd('\n');
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

    private sealed record ProjectAnswer(string Entry, List<ProjectFile> Files);

    /// <summary>Parses a candidate's multi-file answer JSON ({ entry, files: [{ path, content }] }).</summary>
    private static ProjectAnswer? ParseProjectAnswer(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("files", out var filesEl) ||
                filesEl.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var files = new List<ProjectFile>();
            foreach (var el in filesEl.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object)
                    continue;
                var path = el.TryGetProperty("path", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
                if (string.IsNullOrWhiteSpace(path))
                    continue;
                var content = el.TryGetProperty("content", out var c) && c.ValueKind == JsonValueKind.String
                    ? c.GetString() ?? string.Empty
                    : string.Empty;
                files.Add(new ProjectFile(path, content));
            }

            if (files.Count == 0)
                return null;

            var entry = root.TryGetProperty("entry", out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null;
            if (string.IsNullOrWhiteSpace(entry) || files.All(f => f.Path != entry))
                entry = files[0].Path;

            return new ProjectAnswer(entry, files);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
