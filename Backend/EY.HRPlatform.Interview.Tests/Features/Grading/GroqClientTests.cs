using System.Net;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.Interview.Features.Grading.Groq;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Interview.Tests.Features.Grading;

/// <summary>
/// Guards the shape of the outgoing chat-completion request. Groq retires models on
/// a schedule, so the model has to stay config-driven, and the reasoning models that
/// replaced llama-3.3 need parameters the old request didn't send.
/// </summary>
public class GroqClientTests
{
    [Fact]
    public async Task CompleteAsync_SendsConfiguredModel()
    {
        var (client, captured) = ClientWith(new GroqOptions { Model = "openai/gpt-oss-20b" });

        await client.CompleteAsync("system", "user", CancellationToken.None);

        Assert.Equal("openai/gpt-oss-20b", captured.Body.GetProperty("model").GetString());
    }

    [Fact]
    public async Task CompleteAsync_SendsMaxCompletionTokens_NotDeprecatedMaxTokens()
    {
        var (client, captured) = ClientWith(new GroqOptions());

        await client.CompleteAsync("system", "user", CancellationToken.None, maxTokens: 2048);

        Assert.Equal(2048, captured.Body.GetProperty("max_completion_tokens").GetInt32());
        Assert.False(captured.Body.TryGetProperty("max_tokens", out _));
    }

    [Fact]
    public async Task CompleteAsync_OnReasoningModel_SendsEffortAndSuppressesReasoning()
    {
        var (client, captured) = ClientWith(new GroqOptions { ReasoningEffort = "low" });

        await client.CompleteAsync("system", "user", CancellationToken.None);

        Assert.Equal("low", captured.Body.GetProperty("reasoning_effort").GetString());
        // Reasoning must stay out of the content: every caller parses it as JSON.
        Assert.False(captured.Body.GetProperty("include_reasoning").GetBoolean());
        // reasoning_format is mutually exclusive with include_reasoning and
        // incompatible with response_format, so it must never be sent.
        Assert.False(captured.Body.TryGetProperty("reasoning_format", out _));
    }

    [Fact]
    public async Task CompleteAsync_OnNonReasoningModel_OmitsReasoningParameters()
    {
        var (client, captured) = ClientWith(new GroqOptions { ReasoningEffort = "" });

        await client.CompleteAsync("system", "user", CancellationToken.None);

        Assert.False(captured.Body.TryGetProperty("reasoning_effort", out _));
        Assert.False(captured.Body.TryGetProperty("include_reasoning", out _));
    }

    [Fact]
    public async Task CompleteAsync_WithoutResponseFormat_OmitsIt()
    {
        var (client, captured) = ClientWith(new GroqOptions());

        await client.CompleteAsync("system", "user", CancellationToken.None);

        Assert.False(captured.Body.TryGetProperty("response_format", out _));
    }

    [Fact]
    public async Task CompleteAsync_SerializesStrictJsonSchema_WithSnakeCaseKeysIntact()
    {
        var schema = JsonSchemaFormat.Strict("verdict", new
        {
            type = "object",
            properties = new { score = new { type = "number", @enum = new[] { "a", "b" } } },
            required = new[] { "score" },
            additionalProperties = false,
        });
        var (client, captured) = ClientWith(new GroqOptions());

        await client.CompleteAsync("system", "user", CancellationToken.None, responseFormat: schema);

        var format = captured.Body.GetProperty("response_format");
        Assert.Equal("json_schema", format.GetProperty("type").GetString());

        var jsonSchema = format.GetProperty("json_schema");
        Assert.Equal("verdict", jsonSchema.GetProperty("name").GetString());
        Assert.True(jsonSchema.GetProperty("strict").GetBoolean());

        // Schema keywords must survive serialization verbatim — a camel-casing
        // policy would rename them and strict mode would reject the request.
        var inner = jsonSchema.GetProperty("schema");
        Assert.False(inner.GetProperty("additionalProperties").GetBoolean());
        Assert.Equal(
            ["a", "b"],
            inner.GetProperty("properties").GetProperty("score").GetProperty("enum")
                .EnumerateArray().Select(e => e.GetString()));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private sealed class CapturedRequest
    {
        public JsonElement Body { get; set; }
    }

    private static (GroqClient Client, CapturedRequest Captured) ClientWith(GroqOptions options)
    {
        var captured = new CapturedRequest();
        var response = JsonSerializer.Serialize(new
        {
            choices = new[] { new { message = new { content = "{}" } } }
        });

        var handler = new CapturingHandler(async request =>
        {
            var json = await request.Content!.ReadAsStringAsync();
            captured.Body = JsonDocument.Parse(json).RootElement.Clone();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(response, Encoding.UTF8, "application/json"),
            };
        });

        var http = new HttpClient(handler) { BaseAddress = new Uri("https://stub.groq.local") };
        return (new GroqClient(http, Options.Create(options)), captured);
    }

    private sealed class CapturingHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> responder)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => responder(request);
    }
}
