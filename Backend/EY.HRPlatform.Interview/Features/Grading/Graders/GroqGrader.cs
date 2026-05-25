using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Features.Grading.Groq;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

public class GroqGrader(GroqClient groq, ILogger<GroqGrader> logger) : IGrader
{
    private const double LowConfidenceThreshold = 0.7;

    public bool CanGrade(Question question) =>
        question.Type is QuestionType.Essay or QuestionType.CaseStudy
        || (question.Type == QuestionType.Coding && string.IsNullOrWhiteSpace(question.TestCases));

    public async Task<QuestionGradeResultDto> GradeAsync(Question question, string answer, CancellationToken ct)
    {
        var systemPrompt = BuildSystemPrompt(question);
        var userMessage = BuildUserMessage(question, answer);

        string rawResponse;
        try
        {
            rawResponse = await groq.CompleteAsync(systemPrompt, userMessage, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Groq grading failed for question {QuestionId}; routing to human review.", question.Id);
            return new QuestionGradeResultDto(
                QuestionId: question.Id,
                GraderType: "Groq",
                Score: 0m,
                MaxScore: question.Points,
                Feedback: "AI grading unavailable.",
                NeedsHumanReview: true
            );
        }

        var parsed = ParseGradingResponse(rawResponse);
        var score = Math.Clamp(Math.Round((decimal)(parsed.Score / 10.0 * question.Points), 2), 0m, question.Points);
        var needsReview = parsed.Confidence < LowConfidenceThreshold;

        return new QuestionGradeResultDto(
            QuestionId: question.Id,
            GraderType: "Groq",
            Score: score,
            MaxScore: question.Points,
            Feedback: parsed.Feedback,
            NeedsHumanReview: needsReview
        );
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
