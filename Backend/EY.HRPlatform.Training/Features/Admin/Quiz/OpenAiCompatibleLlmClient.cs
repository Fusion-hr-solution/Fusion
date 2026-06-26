using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.Training.Features.Admin.Quiz;

/// <summary>
/// OpenAI-compatible chat-completions client (US-8.2.5, ADR 0009). The HttpClient's BaseAddress +
/// bearer auth are configured at registration; this posts to the configured path and returns the
/// assistant message. Retries 429/5xx with backoff. Modelled on the Interview Groq client.
/// </summary>
public class OpenAiCompatibleLlmClient : ILlmClient
{
    private const int MaxAttempts = 4;

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly HttpClient _httpClient;
    private readonly LlmOptions _options;

    public OpenAiCompatibleLlmClient(HttpClient httpClient, LlmOptions options)
    {
        _httpClient = httpClient;
        _options = options;
    }

    public async Task<string> CompleteAsync(
        string systemPrompt, string userMessage, CancellationToken cancellationToken,
        double temperature = 0.4, int maxTokens = 2048)
    {
        var body = new
        {
            model = _options.Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage },
            },
            temperature,
            max_tokens = maxTokens,
        };

        for (var attempt = 1; ; attempt++)
        {
            using var response = await _httpClient.PostAsJsonAsync(_options.Path, body, cancellationToken);

            if ((response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500)
                && attempt < MaxAttempts)
            {
                await Task.Delay(GetRetryDelay(response, attempt), cancellationToken);
                continue;
            }

            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<ChatResponse>(JsonOptions, cancellationToken)
                ?? throw new InvalidOperationException("Empty LLM response.");

            return result.Choices?.FirstOrDefault()?.Message?.Content
                ?? throw new InvalidOperationException("No content in LLM response.");
        }
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter?.Delta is { } delta && delta > TimeSpan.Zero) return delta;
        if (retryAfter?.Date is { } date)
        {
            var wait = date - DateTimeOffset.UtcNow;
            if (wait > TimeSpan.Zero) return wait;
        }
        return TimeSpan.FromSeconds(Math.Min(Math.Pow(2, attempt - 1), 10));
    }

    private sealed class ChatResponse
    {
        [JsonPropertyName("choices")]
        public List<ChatChoice>? Choices { get; set; }
    }

    private sealed class ChatChoice
    {
        [JsonPropertyName("message")]
        public ChatMessage? Message { get; set; }
    }

    private sealed class ChatMessage
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}
