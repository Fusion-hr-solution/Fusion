using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Features.Grading.Groq;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

public class GroqGrader(
    GroqClient groq,
    ILogger<GroqGrader> logger,
    IOptions<GroqGradingOptions> options) : IGrader
{
    private readonly GroqGradingOptions _options = options.Value;

    public bool CanGrade(Question question) =>
        question.Type is QuestionType.Essay or QuestionType.CaseStudy
        || (question.Type is QuestionType.Coding or QuestionType.Sql
            && string.IsNullOrWhiteSpace(question.TestCases));

    public async Task<QuestionGradeResultDto> GradeAsync(Question question, CandidateAnswer answer, CancellationToken ct)
    {
        var systemPrompt = BuildSystemPrompt(question);
        var userMessage = BuildUserMessage(question, answer.AnswerText);

        var passCount = Math.Max(1, _options.PassCount);

        // Grade passCount times. Passes run sequentially to keep concurrent Groq
        // load bounded (questions are already graded in parallel by the orchestrator).
        var passes = new List<GradingResponse>(passCount);
        for (var i = 0; i < passCount; i++)
        {
            try
            {
                var raw = await groq.CompleteAsync(systemPrompt, userMessage, ct, _options.PassTemperature);
                passes.Add(ParseGradingResponse(raw));
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Groq grading pass {Pass}/{Total} failed for question {QuestionId}.",
                    i + 1, passCount, question.Id);
            }
        }

        if (passes.Count == 0)
        {
            logger.LogWarning("All Groq passes failed for question {QuestionId}; routing to human review.", question.Id);
            return new QuestionGradeResultDto(
                QuestionId: question.Id,
                GraderType: "Groq",
                Score: 0m,
                MaxScore: question.Points,
                Feedback: "AI grading unavailable.",
                NeedsHumanReview: true
            );
        }

        // Reconcile: median score is robust to a single outlier pass.
        var sortedScores = passes.Select(p => p.Score).OrderBy(s => s).ToList();
        var medianScore = Median(sortedScores);
        var spread = sortedScores[^1] - sortedScores[0];
        var avgConfidence = passes.Average(p => p.Confidence);

        var score = Math.Clamp(Math.Round((decimal)(medianScore / 10.0 * question.Points), 2), 0m, question.Points);

        // Flag for review when the model is unsure: low average confidence, the
        // passes disagreed too much, or we couldn't get enough samples to
        // cross-check (a single surviving pass isn't a real "check").
        var disagreement = spread > _options.MaxScoreSpread;
        var insufficientSamples = passes.Count < Math.Min(2, passCount);
        var needsReview = avgConfidence < _options.LowConfidenceThreshold || disagreement || insufficientSamples;

        // Use the feedback from the pass closest to the median.
        var chosen = passes.OrderBy(p => Math.Abs(p.Score - medianScore)).First();
        var feedback = chosen.Feedback;
        if (disagreement)
        {
            var raw = string.Join(", ", sortedScores.Select(s => s.ToString("0.#")));
            feedback = $"[AI grading passes disagreed ({raw} out of 10) — flagged for review] {feedback}";
        }

        logger.LogInformation(
            "Groq triple-check for question {QuestionId}: scores=[{Scores}], median={Median}/10, avgConfidence={Confidence:0.00}, review={Review}.",
            question.Id, string.Join(",", sortedScores.Select(s => s.ToString("0.#"))),
            medianScore.ToString("0.#"), avgConfidence, needsReview);

        return new QuestionGradeResultDto(
            QuestionId: question.Id,
            GraderType: "Groq",
            Score: score,
            MaxScore: question.Points,
            Feedback: feedback,
            NeedsHumanReview: needsReview
        );
    }

    private static double Median(IReadOnlyList<double> sorted)
    {
        var n = sorted.Count;
        if (n == 0) return 0;
        return n % 2 == 1
            ? sorted[n / 2]
            : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
    }

    private static string BuildSystemPrompt(Question question)
    {
        var criteria = string.IsNullOrWhiteSpace(question.EvaluationCriteria)
            ? "Grade based on accuracy, completeness, and clarity."
            : question.EvaluationCriteria;

        return "You are a grading assistant. Grade the following candidate response on a scale of 0–10.\n\n" +
               $"Question: {question.Title}\n" +
               $"Description: {question.Description}\n" +
               $"Evaluation criteria: {criteria}\n\n" +
               "Respond ONLY with valid JSON in this exact format:\n" +
               "{\"score\": <0-10 float>, \"feedback\": \"<brief feedback>\", \"confidence\": <0-1 float>}";
    }

    private static string BuildUserMessage(Question question, string answer) =>
        $"Candidate's answer:\n\n{answer}";

    private record GradingResponse(double Score, string Feedback, double Confidence);

    private static GradingResponse ParseGradingResponse(string raw)
    {
        try
        {
            var start = raw.IndexOf('{');
            var end = raw.LastIndexOf('}');
            if (start >= 0 && end > start)
            {
                var json = raw[start..(end + 1)];
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var score = root.TryGetProperty("score", out var scoreEl) ? scoreEl.GetDouble() : 5.0;
                var feedback = root.TryGetProperty("feedback", out var feedbackEl) ? feedbackEl.GetString() ?? "" : "";
                var confidence = root.TryGetProperty("confidence", out var confEl) ? confEl.GetDouble() : 0.5;

                return new GradingResponse(Math.Clamp(score, 0, 10), feedback, Math.Clamp(confidence, 0, 1));
            }
        }
        catch { }

        return new GradingResponse(0, "Could not parse AI response.", 0.0);
    }
}
