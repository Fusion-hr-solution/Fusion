using System.Text;
using System.Text.Json;
using EY.HRPlatform.Interview.Features.Grading.Groq;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;

namespace EY.HRPlatform.Interview.Features.Questions;

public class QuestionGeneratorService(
    IServiceProvider serviceProvider,
    ILogger<QuestionGeneratorService> logger) : IQuestionGeneratorService
{
    // Contract strings the rest of the API expects (see QuestionService parsers).
    private static readonly string[] ValidTypes =
        ["Coding", "SQL", "Multiple Choice", "Essay", "Case Study", "Excel", "True/False", "Design"];
    private static readonly string[] ValidDifficulties = ["Easy", "Medium", "Hard", "Expert"];
    private static readonly string[] ValidGradingMethods = ["Auto-graded", "Hybrid", "Manual"];

    public async Task<IReadOnlyList<CreateQuestionDto>> GenerateAsync(
        GenerateQuestionsRequestDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Topic))
            throw new ApiException("Topic is required.", StatusCodes.Status400BadRequest);

        // GroqClient is only registered when Groq:ApiKey is configured. Resolve it
        // lazily so this service stays registered unconditionally and degrades to a
        // clean 503 when AI isn't available.
        var groq = serviceProvider.GetService<GroqClient>();
        if (groq is null)
            throw new ApiException("AI question generation is not configured.", StatusCodes.Status503ServiceUnavailable);

        var count = Math.Clamp(request.Count, 1, 10);
        var forcedType = NormalizeOrNull(request.Type, ValidTypes);

        var systemPrompt = BuildSystemPrompt(request, count, forcedType);
        var userMessage = $"Topic: {request.Topic.Trim()}\nGenerate {count} question(s).";
        var maxTokens = Math.Min(4096, 600 * count + 600);

        string raw;
        try
        {
            raw = await groq.CompleteAsync(systemPrompt, userMessage, cancellationToken, temperature: 0.4, maxTokens: maxTokens);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI question generation request failed for topic '{Topic}'.", request.Topic);
            throw new ApiException("AI question generation failed. Please try again.", StatusCodes.Status502BadGateway);
        }

        var drafts = ParseDrafts(raw, request, forcedType);
        if (drafts.Count == 0)
        {
            logger.LogWarning("AI returned no usable questions for topic '{Topic}'. Raw length={Length}.", request.Topic, raw.Length);
            throw new ApiException(
                "The AI did not return any usable questions. Try refining the topic.",
                StatusCodes.Status422UnprocessableEntity);
        }

        return drafts;
    }

    private static string BuildSystemPrompt(GenerateQuestionsRequestDto request, int count, string? forcedType)
    {
        var constraints = new StringBuilder();
        if (forcedType is not null)
            constraints.Append($"- Every question's \"type\" MUST be \"{forcedType}\".\n");
        if (NormalizeOrNull(request.Difficulty, ValidDifficulties) is { } diff)
            constraints.Append($"- Every question's \"difficulty\" MUST be \"{diff}\".\n");
        if (NormalizeOrNull(request.GradingMethod, ValidGradingMethods) is { } grading)
            constraints.Append($"- Every question's \"gradingMethod\" MUST be \"{grading}\".\n");
        if (!string.IsNullOrWhiteSpace(request.Language))
            constraints.Append($"- For Coding/SQL questions, use language \"{request.Language.Trim()}\".\n");
        if (request.Points is > 0)
            constraints.Append($"- Set \"points\" to {request.Points}.\n");
        if (request.DurationMinutes is > 0)
            constraints.Append($"- Set \"durationMinutes\" to {request.DurationMinutes}.\n");
        if (constraints.Length == 0)
            constraints.Append("- Infer the most appropriate values for any field not dictated by the topic.\n");

        return
            $"You are an expert technical assessment author. Generate exactly {count} interview " +
            "question(s) about the topic the user provides.\n\n" +
            "Respond with ONLY a JSON array (no markdown fences, no commentary). Each element is an " +
            "object with EXACTLY these fields:\n" +
            "{\n" +
            "  \"type\": one of [Coding, SQL, Multiple Choice, Essay, Case Study, Excel, True/False, Design],\n" +
            "  \"title\": short title (max 200 chars),\n" +
            "  \"description\": the full question text,\n" +
            "  \"difficulty\": one of [Easy, Medium, Hard, Expert],\n" +
            "  \"gradingMethod\": one of [Auto-graded, Hybrid, Manual],\n" +
            "  \"points\": integer 1-100,\n" +
            "  \"durationMinutes\": integer 1-120,\n" +
            "  \"tags\": array of short tag strings,\n" +
            "  \"options\": array of {\"text\": string, \"correct\": boolean} — REQUIRED for \"Multiple Choice\" " +
            "(3-5 options, exactly one correct) and \"True/False\" (exactly two options True/False); [] otherwise,\n" +
            "  \"language\": programming language string — REQUIRED for \"Coding\" and \"SQL\"; \"\" otherwise,\n" +
            "  \"starterCode\": optional starter code; \"\" if none,\n" +
            "  \"evaluationCriteria\": grading rubric for open-ended answers (Essay/Case Study); \"\" otherwise\n" +
            "}\n\n" +
            "Constraints:\n" + constraints;
    }

    private List<CreateQuestionDto> ParseDrafts(string raw, GenerateQuestionsRequestDto request, string? forcedType)
    {
        var drafts = new List<CreateQuestionDto>();
        try
        {
            var start = raw.IndexOf('[');
            var end = raw.LastIndexOf(']');
            if (start < 0 || end <= start)
                return drafts;

            using var doc = JsonDocument.Parse(raw[start..(end + 1)]);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return drafts;

            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object)
                    continue;

                var draft = MapDraft(el, request, forcedType);
                if (draft is not null)
                    drafts.Add(draft);
            }
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Failed to parse AI question-generation response as JSON.");
        }

        return drafts;
    }

    private static CreateQuestionDto? MapDraft(JsonElement el, GenerateQuestionsRequestDto request, string? forcedType)
    {
        var title = GetString(el, "title").Trim();
        var description = GetString(el, "description").Trim();
        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(description))
            return null;

        // Title is required on save; if the model omitted it, derive one from the
        // description so the draft is immediately saveable/editable.
        if (string.IsNullOrWhiteSpace(title))
            title = DeriveTitleFromDescription(description);

        var type = forcedType
            ?? NormalizeOrNull(GetString(el, "type"), ValidTypes)
            ?? "Multiple Choice";

        var difficulty = NormalizeOrNull(request.Difficulty, ValidDifficulties)
            ?? NormalizeOrNull(GetString(el, "difficulty"), ValidDifficulties)
            ?? "Medium";

        var gradingMethod = NormalizeOrNull(request.GradingMethod, ValidGradingMethods)
            ?? NormalizeOrNull(GetString(el, "gradingMethod"), ValidGradingMethods)
            ?? DefaultGradingFor(type);

        var points = request.Points is > 0 ? request.Points.Value : Math.Clamp(GetInt(el, "points") ?? 10, 1, 100);
        var duration = request.DurationMinutes is > 0 ? request.DurationMinutes.Value : Math.Clamp(GetInt(el, "durationMinutes") ?? 10, 1, 120);

        var isChoice = type is "Multiple Choice" or "True/False";
        var isCode = type is "Coding" or "SQL";

        var options = isChoice ? ReadOptions(el, type) : [];
        var language = isCode
            ? FirstNonBlank(request.Language, GetString(el, "language"), type == "SQL" ? "SQL" : "Python")
            : string.Empty;

        return new CreateQuestionDto
        {
            Type = type,
            Title = title.Length > 200 ? title[..200] : title,
            Description = description,
            Difficulty = difficulty,
            GradingMethod = gradingMethod,
            Points = points,
            DurationMinutes = duration,
            Tags = ReadTags(el),
            Options = options,
            Language = language,
            StarterCode = isCode ? GetString(el, "starterCode") : string.Empty,
            EvaluationCriteria = type is "Essay" or "Case Study" ? GetString(el, "evaluationCriteria").Trim() : string.Empty,
            TestCases = null,
        };
    }

    private static List<QuestionOptionDto> ReadOptions(JsonElement el, string type)
    {
        var options = new List<QuestionOptionDto>();
        if (el.TryGetProperty("options", out var optsEl) && optsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var o in optsEl.EnumerateArray())
            {
                if (o.ValueKind != JsonValueKind.Object)
                    continue;
                var text = GetString(o, "text").Trim();
                if (string.IsNullOrWhiteSpace(text))
                    continue;
                options.Add(new QuestionOptionDto { Text = text, Correct = GetBool(o, "correct") });
            }
        }

        if (type == "True/False")
        {
            // Normalize to a clean True/False pair regardless of what the model returned.
            var trueCorrect = options.FirstOrDefault(o =>
                o.Text.Equals("True", StringComparison.OrdinalIgnoreCase))?.Correct ?? true;
            options =
            [
                new QuestionOptionDto { Text = "True", Correct = trueCorrect },
                new QuestionOptionDto { Text = "False", Correct = !trueCorrect },
            ];
        }
        else if (options.Count > 0 && !options.Any(o => o.Correct))
        {
            // Ensure at least one correct option so the draft is directly saveable.
            options[0] = new QuestionOptionDto { Text = options[0].Text, Correct = true };
        }

        return options;
    }

    private static List<string> ReadTags(JsonElement el)
    {
        var tags = new List<string>();
        if (el.TryGetProperty("tags", out var tagsEl) && tagsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var t in tagsEl.EnumerateArray())
            {
                if (t.ValueKind != JsonValueKind.String)
                    continue;
                var tag = t.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(tag) && !tags.Contains(tag))
                    tags.Add(tag);
            }
        }

        return tags;
    }

    private static string DeriveTitleFromDescription(string description)
    {
        var firstLine = description
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault();
        if (string.IsNullOrWhiteSpace(firstLine))
            return "Untitled question";

        const int maxLength = 80;
        if (firstLine.Length <= maxLength)
            return firstLine;

        // Trim to a word boundary near the limit so the title reads cleanly.
        var truncated = firstLine[..maxLength];
        var lastSpace = truncated.LastIndexOf(' ');
        if (lastSpace > 40)
            truncated = truncated[..lastSpace];
        return truncated.TrimEnd() + "…";
    }

    private static string DefaultGradingFor(string type) => type switch
    {
        "Multiple Choice" or "True/False" or "Coding" or "SQL" => "Auto-graded",
        "Essay" or "Case Study" or "Design" => "Manual",
        _ => "Manual",
    };

    private static string? NormalizeOrNull(string? value, string[] valid)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return valid.FirstOrDefault(v => v.Equals(trimmed, StringComparison.OrdinalIgnoreCase));
    }

    private static string FirstNonBlank(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;

    private static string GetString(JsonElement el, string name) =>
        el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() ?? string.Empty : string.Empty;

    private static int? GetInt(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var p))
            return null;
        if (p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var v))
            return v;
        if (p.ValueKind == JsonValueKind.String && int.TryParse(p.GetString(), out var s))
            return s;
        return null;
    }

    private static bool GetBool(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var p))
            return false;
        return p.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(p.GetString(), out var b) && b,
            _ => false,
        };
    }
}
