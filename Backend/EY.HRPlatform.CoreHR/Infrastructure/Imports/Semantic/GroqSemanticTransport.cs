using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;

/// <summary>
/// One closed classification request: fixed instructions, the domain's bounded evidence as data,
/// and the exact questions whose keys and allowed targets constrain the structured answer.
/// </summary>
public sealed record GroqSemanticAsk(
    string ApiKey,
    string Model,
    string Instructions,
    object Input,
    string SchemaName,
    string ResultContractVersion,
    IReadOnlyList<ImportSemanticIssue> Questions,
    int MaxCompletionTokens = 1200,
    string? ReasoningEffort = "low");

/// <summary>
/// Groq chat-completions transport shared by every import domain: strict <c>json_schema</c>
/// output enumerating only the questions and targets Fusion allows, Suggest-or-Abstain answers,
/// provider status mapped to failure categories, and Retry-After honoured. Exactly one call;
/// retries and budgets belong to <see cref="ImportSemanticRunner"/>. What a question means and
/// which evidence it carries stay with the domain provider.
/// </summary>
public static class GroqSemanticTransport
{
    private static readonly JsonSerializerOptions EnvelopeJson = new(JsonSerializerDefaults.Web);
    private static readonly JsonSerializerOptions StructuredJson = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) },
    };

    public static async Task<ImportSemanticProviderResult> AskAsync(
        HttpClient httpClient,
        GroqSemanticAsk ask,
        CancellationToken cancellationToken)
    {
        var body = new Dictionary<string, object?>
        {
            ["model"] = ask.Model,
            ["messages"] = new object[]
            {
                new { role = "system", content = ask.Instructions },
                // Source-derived evidence travels only as data in the user message, never as instructions.
                new { role = "user", content = JsonSerializer.Serialize(ask.Input) },
            },
            ["temperature"] = 0.1,
            ["max_completion_tokens"] = ask.MaxCompletionTokens,
            ["stream"] = false,
            ["response_format"] = new
            {
                type = "json_schema",
                json_schema = new
                {
                    name = ask.SchemaName,
                    strict = true,
                    schema = CreateSchema(ask),
                },
            },
        };
        if (ask.ReasoningEffort is not null) body["reasoning_effort"] = ask.ReasoningEffort;

        using var message = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = JsonContent.Create(body),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ask.ApiKey.Trim());
        using var response = await httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw FailureFor(response);

        GroqChatResponse? envelope;
        try
        {
            envelope = await response.Content.ReadFromJsonAsync<GroqChatResponse>(EnvelopeJson, cancellationToken);
        }
        catch (JsonException exception)
        {
            throw InvalidOutput(exception);
        }

        var content = envelope?.Choices?.FirstOrDefault()?.Message?.Content;
        if (string.IsNullOrWhiteSpace(content)) throw InvalidOutput();
        try
        {
            var document = JsonSerializer.Deserialize<StructuredAnswerDocument>(content, StructuredJson);
            if (document is null
                || !string.Equals(document.ContractVersion, ask.ResultContractVersion, StringComparison.Ordinal)
                || document.Answers is null
                || document.Answers.Count > ask.Questions.Count
                || !MatchesSchemaEnums(document.Answers, ask.Questions))
                throw InvalidOutput();
            return new ImportSemanticProviderResult(
                document.Answers
                    .Select(item => new ImportSemanticAnswer(item.QuestionKey, item.Disposition, item.TargetKey))
                    .ToList(),
                envelope?.Usage?.PromptTokens,
                envelope?.Usage?.CompletionTokens,
                envelope?.Id,
                envelope?.SystemFingerprint);
        }
        catch (JsonException exception)
        {
            throw InvalidOutput(exception);
        }
    }

    private static bool MatchesSchemaEnums(IReadOnlyList<StructuredAnswer> answers, IReadOnlyList<ImportSemanticIssue> questions)
    {
        var issueKeys = questions.Select(issue => issue.Key).ToHashSet(StringComparer.Ordinal);
        var targetKeys = questions.SelectMany(issue => issue.AllowedTargets).Select(target => target.Key)
            .ToHashSet(StringComparer.Ordinal);
        return answers.All(item =>
            !string.IsNullOrWhiteSpace(item.QuestionKey)
            && issueKeys.Contains(item.QuestionKey)
            && (item.TargetKey is null || targetKeys.Contains(item.TargetKey)));
    }

    private static object CreateSchema(GroqSemanticAsk ask)
    {
        var questionKeys = ask.Questions.Select(issue => issue.Key).Distinct(StringComparer.Ordinal).ToArray();
        var targetKeys = ask.Questions.SelectMany(issue => issue.AllowedTargets).Select(target => target.Key)
            .Distinct(StringComparer.Ordinal).ToArray();
        return new
        {
            type = "object",
            properties = new
            {
                contractVersion = new { type = "string", @enum = new[] { ask.ResultContractVersion } },
                answers = new
                {
                    type = "array",
                    maxItems = ask.Questions.Count,
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            questionKey = new { type = "string", @enum = questionKeys },
                            disposition = new { type = "string", @enum = new[] { "suggest", "abstain" } },
                            targetKey = new
                            {
                                anyOf = new object[]
                                {
                                    new { type = "string", @enum = targetKeys },
                                    new { type = "null" },
                                },
                            },
                        },
                        required = new[] { "questionKey", "disposition", "targetKey" },
                        additionalProperties = false,
                    },
                },
            },
            required = new[] { "contractVersion", "answers" },
            additionalProperties = false,
        };
    }

    private static ImportSemanticProviderException FailureFor(HttpResponseMessage response)
        => (int)response.StatusCode switch
        {
            429 => new(ImportSemanticFailureCategory.RateLimited,
                "Automatic matching is temporarily unavailable.", RetryAfter(response)),
            401 or 403 => new(ImportSemanticFailureCategory.Unauthorized,
                "Automatic matching is not authorized."),
            // 498: provider capacity exceeded. 5xx: transient provider trouble.
            498 or >= 500 => new(ImportSemanticFailureCategory.ProviderUnavailable,
                "Automatic matching is unavailable right now."),
            // Other 4xx: the request or the configured model was refused. Retrying won't change that.
            _ => new(ImportSemanticFailureCategory.ProviderRejected,
                "Automatic matching could not be used with the current configuration."),
        };

    private static DateTime? RetryAfter(HttpResponseMessage response)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta)
            return DateTime.UtcNow.Add(delta > TimeSpan.Zero ? delta : TimeSpan.Zero);
        return response.Headers.RetryAfter?.Date?.UtcDateTime;
    }

    private static ImportSemanticProviderException InvalidOutput(Exception? innerException = null)
        => new(
            ImportSemanticFailureCategory.InvalidOutput,
            "Automatic matching returned an unusable result.",
            innerException: innerException);

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    private sealed class StructuredAnswerDocument
    {
        [JsonRequired]
        public string ContractVersion { get; init; } = string.Empty;

        [JsonRequired]
        public List<StructuredAnswer> Answers { get; init; } = [];
    }

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    private sealed class StructuredAnswer
    {
        [JsonRequired]
        public string QuestionKey { get; init; } = string.Empty;

        [JsonRequired]
        public ImportSemanticDisposition Disposition { get; init; }

        [JsonRequired]
        public string? TargetKey { get; init; }
    }

    private sealed class GroqChatResponse
    {
        public string? Id { get; init; }

        [JsonPropertyName("system_fingerprint")]
        public string? SystemFingerprint { get; init; }

        public List<GroqChoice>? Choices { get; init; }
        public GroqUsage? Usage { get; init; }
    }

    private sealed class GroqChoice
    {
        public GroqMessage? Message { get; init; }
    }

    private sealed class GroqMessage
    {
        public string? Content { get; init; }
    }

    private sealed class GroqUsage
    {
        [JsonPropertyName("prompt_tokens")]
        public int? PromptTokens { get; init; }

        [JsonPropertyName("completion_tokens")]
        public int? CompletionTokens { get; init; }
    }
}
