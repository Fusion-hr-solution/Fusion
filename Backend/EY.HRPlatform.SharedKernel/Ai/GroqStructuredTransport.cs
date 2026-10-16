using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.SharedKernel.Ai;

/// <summary>
/// One structured-output request: fixed instructions, the module's bounded input as data, and the
/// JSON schema of the only answer the module accepts. What the input and answer mean stays with the module.
/// </summary>
public sealed record GroqStructuredRequest(
    string ApiKey,
    string Model,
    string Instructions,
    object Input,
    string SchemaName,
    object Schema,
    int MaxCompletionTokens = 1200,
    string? ReasoningEffort = "low",
    double Temperature = 0.1);

/// <summary>The provider's structured answer as raw JSON, plus usage and provenance. Read it with <see cref="Read{T}"/>.</summary>
public sealed record AiStructuredResult(
    JsonElement Content,
    int? InputTokens,
    int? OutputTokens,
    string? ResponseId,
    string? SystemFingerprint)
{
    /// <summary>
    /// Deserializes the answer into the module's strict document type. Anything the type rejects
    /// (unknown members, wrong enum values, missing required members) becomes invalid output.
    /// </summary>
    public T Read<T>(JsonSerializerOptions options, string safeMessage = GroqStructuredTransport.InvalidOutputMessage) where T : class
    {
        try
        {
            return Content.Deserialize<T>(options) ?? throw GroqStructuredTransport.InvalidOutput(safeMessage);
        }
        catch (JsonException exception)
        {
            throw GroqStructuredTransport.InvalidOutput(safeMessage, exception);
        }
    }
}

/// <summary>
/// Groq chat-completions transport shared by every module: strict <c>json_schema</c> output, provider
/// status mapped to <see cref="AiFailureCategory"/>, Retry-After honoured. Exactly one call; retries,
/// budgets and timeouts belong to the caller. Never logs or returns prompt, input or response text.
/// </summary>
public static class GroqStructuredTransport
{
    public const string InvalidOutputMessage = "AI returned an unusable result.";

    private static readonly JsonSerializerOptions EnvelopeJson = new(JsonSerializerDefaults.Web);

    public static async Task<AiStructuredResult> CompleteAsync(
        HttpClient httpClient,
        GroqStructuredRequest request,
        CancellationToken cancellationToken,
        AiSafeMessages? messages = null)
    {
        messages ??= AiSafeMessages.Default;
        var body = new Dictionary<string, object?>
        {
            ["model"] = request.Model,
            ["messages"] = new object[]
            {
                new { role = "system", content = request.Instructions },
                // Customer-derived input travels only as data in the user message, never as instructions.
                new { role = "user", content = JsonSerializer.Serialize(request.Input) },
            },
            ["temperature"] = request.Temperature,
            ["max_completion_tokens"] = request.MaxCompletionTokens,
            ["stream"] = false,
            ["response_format"] = new
            {
                type = "json_schema",
                json_schema = new
                {
                    name = request.SchemaName,
                    strict = true,
                    schema = request.Schema,
                },
            },
        };
        if (request.ReasoningEffort is not null) body["reasoning_effort"] = request.ReasoningEffort;

        using var message = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = JsonContent.Create(body),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ApiKey.Trim());
        using var response = await httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw FailureFor(response, messages);

        GroqChatResponse? envelope;
        try
        {
            envelope = await response.Content.ReadFromJsonAsync<GroqChatResponse>(EnvelopeJson, cancellationToken);
        }
        catch (JsonException exception)
        {
            throw InvalidOutput(messages.InvalidOutput, exception);
        }

        var content = envelope?.Choices?.FirstOrDefault()?.Message?.Content;
        if (string.IsNullOrWhiteSpace(content)) throw InvalidOutput(messages.InvalidOutput);
        JsonElement document;
        try
        {
            using var parsed = JsonDocument.Parse(content);
            document = parsed.RootElement.Clone();
        }
        catch (JsonException exception)
        {
            throw InvalidOutput(messages.InvalidOutput, exception);
        }
        if (document.ValueKind != JsonValueKind.Object) throw InvalidOutput(messages.InvalidOutput);

        return new AiStructuredResult(
            document,
            envelope?.Usage?.PromptTokens,
            envelope?.Usage?.CompletionTokens,
            envelope?.Id,
            envelope?.SystemFingerprint);
    }

    internal static AiProviderException InvalidOutput(string safeMessage, Exception? innerException = null)
        => new(AiFailureCategory.InvalidOutput, safeMessage, innerException: innerException);

    private static AiProviderException FailureFor(HttpResponseMessage response, AiSafeMessages messages)
        => (int)response.StatusCode switch
        {
            429 => new(AiFailureCategory.RateLimited, messages.RateLimited, RetryAfter(response)),
            401 or 403 => new(AiFailureCategory.Unauthorized, messages.Unauthorized),
            // 498: provider capacity exceeded. 5xx: transient provider trouble.
            498 or >= 500 => new(AiFailureCategory.ProviderUnavailable, messages.Unavailable),
            // Other 4xx: the request or the configured model was refused. Retrying won't change that.
            _ => new(AiFailureCategory.ProviderRejected, messages.Rejected),
        };

    private static DateTime? RetryAfter(HttpResponseMessage response)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta)
            return DateTime.UtcNow.Add(delta > TimeSpan.Zero ? delta : TimeSpan.Zero);
        return response.Headers.RetryAfter?.Date?.UtcDateTime;
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

/// <summary>The user-safe wording a module attaches to each failure category, so its product language stays its own.</summary>
public sealed record AiSafeMessages(
    string RateLimited,
    string Unauthorized,
    string Unavailable,
    string Rejected,
    string InvalidOutput)
{
    public static AiSafeMessages Default { get; } = new(
        "AI is temporarily unavailable.",
        "AI is not authorized.",
        "AI is unavailable right now.",
        "AI could not be used with the current configuration.",
        GroqStructuredTransport.InvalidOutputMessage);
}
