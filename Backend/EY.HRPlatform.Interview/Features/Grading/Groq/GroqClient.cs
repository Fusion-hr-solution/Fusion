using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.Interview.Features.Grading.Groq;

public class GroqClient(HttpClient httpClient)
{
    private const string Model = "llama-3.3-70b-versatile";
    private const int MaxAttempts = 5;

    // Bound how many Groq requests are in flight app-wide. Self-consistency
    // grading multiplies request volume, and Groq rate-limits aggressively (429).
    // A small global gate keeps bursts under the limit; Retry-After handles the rest.
    private static readonly SemaphoreSlim Gate = new(3, 3);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<string> CompleteAsync(
        string systemPrompt, string userMessage, CancellationToken ct,
        double temperature = 0.2, int maxTokens = 512)
    {
        var body = new
        {
            model = Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage },
            },
            temperature,
            max_tokens = maxTokens,
        };

        await Gate.WaitAsync(ct);
        try
        {
            for (var attempt = 1; ; attempt++)
            {
                using var response = await httpClient.PostAsJsonAsync(
                    "/openai/v1/chat/completions", body, ct);

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
