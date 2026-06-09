using System.Text.Json;

namespace EY.HRPlatform.Interview.Features.Grading;

/// <summary>
/// A single candidate answer, decoupled from the raw submission JSON shape.
/// MultipleChoice/TrueFalse answers populate <see cref="SelectedOptionIds"/>;
/// open-ended/coding answers populate <see cref="AnswerText"/>.
/// </summary>
public sealed record CandidateAnswer(string AnswerText, IReadOnlyList<string> SelectedOptionIds)
{
    public static readonly CandidateAnswer Empty = new(string.Empty, []);

    public bool HasResponse =>
        !string.IsNullOrWhiteSpace(AnswerText) || SelectedOptionIds.Count > 0;
}

/// <summary>
/// Parses the candidate submission payload stored in
/// <c>CandidateTestAttempt.AnswersJson</c>. The frontend serializes answers as
/// <c>{ "responses": [ { "questionId", "answerText", "selectedOptionIds" } ] }</c>
/// (a bare array at the root is also accepted), keyed by question id.
/// </summary>
public static class CandidateAnswerParser
{
    public static IReadOnlyDictionary<string, CandidateAnswer> Parse(string? answersJson)
    {
        var map = new Dictionary<string, CandidateAnswer>();
        if (string.IsNullOrWhiteSpace(answersJson))
            return map;

        try
        {
            using var doc = JsonDocument.Parse(answersJson);
            var root = doc.RootElement;

            JsonElement responses;
            if (root.ValueKind == JsonValueKind.Array)
            {
                responses = root;
            }
            else if (root.ValueKind == JsonValueKind.Object &&
                     root.TryGetProperty("responses", out var responsesEl) &&
                     responsesEl.ValueKind == JsonValueKind.Array)
            {
                responses = responsesEl;
            }
            else
            {
                return map;
            }

            foreach (var item in responses.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                    continue;
                if (!item.TryGetProperty("questionId", out var qidEl) ||
                    qidEl.ValueKind != JsonValueKind.String)
                    continue;

                var questionId = qidEl.GetString();
                if (string.IsNullOrWhiteSpace(questionId))
                    continue;

                var answerText = item.TryGetProperty("answerText", out var atEl) &&
                                 atEl.ValueKind == JsonValueKind.String
                    ? atEl.GetString() ?? string.Empty
                    : string.Empty;

                var optionIds = new List<string>();
                if (item.TryGetProperty("selectedOptionIds", out var optsEl) &&
                    optsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var opt in optsEl.EnumerateArray())
                    {
                        if (opt.ValueKind != JsonValueKind.String)
                            continue;
                        var value = opt.GetString();
                        if (!string.IsNullOrWhiteSpace(value))
                            optionIds.Add(value);
                    }
                }

                map[questionId] = new CandidateAnswer(answerText, optionIds);
            }
        }
        catch
        {
            // Malformed JSON — treat as no answers rather than failing the whole grade.
        }

        return map;
    }

    public static CandidateAnswer For(string? answersJson, string questionId) =>
        Parse(answersJson).TryGetValue(questionId, out var answer) ? answer : CandidateAnswer.Empty;
}
