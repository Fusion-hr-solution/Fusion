using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.Interview.Features.Grading.Groq;

public class GroqClient(HttpClient httpClient)
{
    private const string Model = "llama-3.3-70b-versatile";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<string> CompleteAsync(string systemPrompt, string userMessage, CancellationToken ct)
    {
        var body = new
        {
            model = Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage },
            },
            temperature = 0.2,
            max_tokens = 512,
        };

        var response = await httpClient.PostAsJsonAsync("/openai/v1/chat/completions", body, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<GroqResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("Empty Groq response.");

        return result.Choices?.FirstOrDefault()?.Message?.Content
            ?? throw new InvalidOperationException("No content in Groq response.");
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
