using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Features.Grading.FrontendRunner;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

/// <summary>
/// Grades a Frontend Project question by running the candidate's submitted source against the
/// AUTHOR'S hidden tests in a sandboxed runner. Only questions that ship an author test suite are
/// auto-graded here; those without tests fall through to human review (the "Both" model).
///
/// Trust: the author's test files are overlaid ON TOP of the candidate's files (author paths win),
/// so a candidate can't read, delete, or fake the grading tests, and can't pass by supplying their
/// own trivially-green tests.
/// </summary>
public class FrontendProjectGrader(IFrontendProjectRunner runner, ILogger<FrontendProjectGrader> logger) : IGrader
{
    private const string DefaultTestCommand = "npm test";

    public bool CanGrade(Question question) =>
        question.Type == QuestionType.FrontendProject
        && !string.IsNullOrWhiteSpace(question.FrontendTestFiles);

    public async Task<QuestionGradeResultDto> GradeAsync(Question question, CandidateAnswer answer, CancellationToken ct)
    {
        var candidateFiles = ParseFiles(answer.AnswerText);
        if (candidateFiles.Count == 0)
        {
            return Result(question, 0m, "No submission to grade.", needsReview: false);
        }

        var authorTests = ParseFiles(question.FrontendTestFiles);
        if (authorTests.Count == 0)
        {
            // CanGrade guards against this, but stay safe: no tests → human review.
            return Result(question, 0m, "No grading tests defined.", needsReview: true);
        }

        // Overlay author tests on top of the candidate's files — author paths win (hidden, tamper-proof).
        var merged = new Dictionary<string, FrontendRunFile>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in candidateFiles)
            merged[file.Path] = file;
        foreach (var file in authorTests)
            merged[file.Path] = file;

        var framework = NormalizeFramework(question.Framework);

        FrontendRunResult run;
        try
        {
            run = await runner.RunAsync(
                new FrontendRunRequest(framework, merged.Values.ToList(), DefaultTestCommand), ct);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Frontend runner threw while grading question {QuestionId}.", question.Id);
            return Result(question, 0m, "Automated run failed; queued for review.", needsReview: true);
        }

        return run.Status switch
        {
            FrontendRunStatus.InstallFailed =>
                Result(question, 0m, "Dependency install failed; queued for review.", needsReview: true),
            FrontendRunStatus.Timeout =>
                Result(question, 0m, "Test run timed out; queued for review.", needsReview: true),
            FrontendRunStatus.Error =>
                Result(question, 0m, "Automated run failed; queued for review.", needsReview: true),
            FrontendRunStatus.Ran => ScoreFromCounts(question, run),
            _ => Result(question, 0m, "Automated run failed; queued for review.", needsReview: true),
        };
    }

    private static QuestionGradeResultDto ScoreFromCounts(Question question, FrontendRunResult run)
    {
        if (run.TestsTotal is int total && total > 0)
        {
            var passed = Math.Clamp(run.TestsPassed ?? 0, 0, total);
            var score = Math.Round((decimal)passed / total * question.Points, 2);
            return Result(question, score, $"{passed}/{total} tests passed.", needsReview: false);
        }

        // No usable counts. Either the report was unreadable, or the suite never collected any tests
        // (a compile/import error). Both are ambiguous: it may be the candidate's broken code, or a
        // fault in OUR runner image. Never guess a score — a silent 0 would hide the latter.
        return Result(
            question,
            0m,
            "No test results were produced (the suite may have failed to compile); queued for review.",
            needsReview: true);
    }

    private static QuestionGradeResultDto Result(Question question, decimal score, string feedback, bool needsReview) =>
        new(
            QuestionId: question.Id,
            GraderType: "FrontendProject",
            Score: score,
            MaxScore: question.Points,
            Feedback: feedback,
            NeedsHumanReview: needsReview);

    private static string NormalizeFramework(string? framework) => (framework ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "angular" => "angular",
        "next" or "next.js" or "nextjs" => "next",
        _ => "react",
    };

    /// <summary>Parses a project JSON ({ files: [{ path, content }], entry? }) into a flat file list.</summary>
    private static List<FrontendRunFile> ParseFiles(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("files", out var filesEl) ||
                filesEl.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var files = new List<FrontendRunFile>();
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
                files.Add(new FrontendRunFile(path, content));
            }

            return files;
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
