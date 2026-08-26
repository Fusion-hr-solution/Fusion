using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Interview.Features.Grading.Groq;

public class GroqClient(HttpClient httpClient, IOptions<GroqOptions> options)
{
    private readonly GroqOptions _options = options.Value;

    private const int MaxAttempts = 5;

    // Bound how many Groq requests are in flight app-wide. Self-consistency
    // grading multiplies request volume, and Groq rate-limits aggressively (429).
    // A small global gate keeps bursts under the limit; Retry-After handles the rest.
    private static readonly SemaphoreSlim Gate = new(3, 3);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <param name="responseFormat">
    /// Optional Groq <c>response_format</c> value — see <see cref="JsonSchemaFormat"/>.
    /// When supplied the model is constrained to the schema instead of being asked
    /// for JSON in the prompt and trusted to comply.
    /// </param>
    public async Task<string> CompleteAsync(
        string systemPrompt, string userMessage, CancellationToken ct,
        double temperature = 0.2, int maxTokens = 1024, object? responseFormat = null)
    {
        var body = new Dictionary<string, object?>
        {
            ["model"] = _options.Model,
            ["messages"] = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage },
            },
            ["temperature"] = temperature,
            // max_tokens is deprecated on Groq's OpenAI-compatible endpoint.
            ["max_completion_tokens"] = maxTokens,
        };

        // Reasoning models (gpt-oss) spend part of the completion budget thinking
        // before emitting the answer, so maxTokens has to cover both. Keep the
        // reasoning out of the returned content — every caller parses it as JSON.
        if (_options.IsReasoningModel)
        {
            body["reasoning_effort"] = _options.ReasoningEffort;
            // include_reasoning rather than reasoning_format: the latter is
            // mutually exclusive with it and incompatible with response_format.
            body["include_reasoning"] = false;
        }

        if (responseFormat is not null)
            body["response_format"] = responseFormat;

        await Gate.WaitAsync(ct);
        try
        {
            for (var attempt = 1; ; attempt++)
            {
                using var response = await httpClient.PostAsJsonAsync(
                    "/openai/v1/chat/completions", body, JsonOptions, ct);

                // Retry on rate limiting (429) and transient 5xx, honoring Retry-After.
                if ((response.StatusCode == HttpStatusCode.TooManyRequests ||
                     (int)response.StatusCode >= 500) && attempt < MaxAttempts)
                {
                    var delay = GetRetryDelay(response, attempt);
                    await Task.Delay(delay, ct);
                    continue;
                }

                response.EnsureSuccessStatusCode();

                var result = await response.Content.ReadFromJsonAsync<GroqResponse>(JsonOptions, ct)
                    ?? throw new InvalidOperationException("Empty Groq response.");

                return result.Choices?.FirstOrDefault()?.Message?.Content
                    ?? throw new InvalidOperationException("No content in Groq response.");
            }
        }
        finally
        {
            Gate.Release();
        }
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        // Prefer the server's Retry-After (Groq sends it on 429).
        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter?.Delta is { } delta && delta > TimeSpan.Zero)
            return delta;
        if (retryAfter?.Date is { } date)
        {
            var wait = date - DateTimeOffset.UtcNow;
            if (wait > TimeSpan.Zero) return wait;
        }
        // Fallback: exponential backoff (1s, 2s, 4s, 8s), capped at 10s.
        var seconds = Math.Min(Math.Pow(2, attempt - 1), 10);
        return TimeSpan.FromSeconds(seconds);
    }

    private sealed class GroqResponse
    {
        [JsonPropertyName("choices")]
        public List<GroqChoice>? Choices { get; set; }
    }

    private sealed class GroqChoice
    {
        [JsonPropertyName("message")]
        public GroqMessage? Message { get; set; }
    }

    private sealed class GroqMessage
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}
