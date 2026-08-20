using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class GroqOrganizationImportSemanticProviderTests
{
    [Fact]
    public async Task SendsOneStrictBoundedStructuredRequestAndReadsNormalGroqEnvelope()
    {
        string? requestBody = null;
        AuthenticationHeaderValue? authorization = null;
        Uri? requestUri = null;
        var handler = new DelegateHandler(async (message, cancellationToken) =>
        {
            requestUri = message.RequestUri;
            authorization = message.Headers.Authorization;
            requestBody = await message.Content!.ReadAsStringAsync(cancellationToken);
            var structured = JsonSerializer.Serialize(new
            {
                contractVersion = OrganizationImportSemanticAssistanceOptions.DefaultContractVersion,
                suggestions = new[]
                {
                    new
                    {
                        issueKey = "level-type:0",
                        kind = OrganizationImportSemanticKinds.OrganizationTypeMapping,
                        targetKey = $"type:{Guid.Parse("11111111-1111-1111-1111-111111111111")}",
                        rationale = "Entity represents the organization level.",
                    },
                },
            });
            return Json(HttpStatusCode.OK, new
            {
                id = "chatcmpl-demo",
                @object = "chat.completion",
                created = 1,
                model = OrganizationImportSemanticAssistanceOptions.DefaultModel,
                choices = new[] { new { index = 0, message = new { role = "assistant", content = structured }, finish_reason = "stop" } },
                usage = new { prompt_tokens = 31, completion_tokens = 12, total_tokens = 43 },
            });
        });
        var provider = Provider(handler);

        var result = await provider.SuggestAsync(Request(), CancellationToken.None);

        Assert.Equal(new Uri("https://api.groq.com/openai/v1/chat/completions"), requestUri);
        Assert.Equal("Bearer", authorization?.Scheme);
        Assert.Equal("test-secret", authorization?.Parameter);
        Assert.Equal(31, result.InputTokens);
        Assert.Equal(12, result.OutputTokens);
        Assert.Single(result.Suggestions);
        using var body = JsonDocument.Parse(requestBody!);
        var root = body.RootElement;
        Assert.Equal(OrganizationImportSemanticAssistanceOptions.DefaultModel, root.GetProperty("model").GetString());
        Assert.False(root.GetProperty("stream").GetBoolean());
        Assert.False(root.TryGetProperty("tools", out _));
        Assert.Equal("json_schema", root.GetProperty("response_format").GetProperty("type").GetString());
        var jsonSchema = root.GetProperty("response_format").GetProperty("json_schema");
        Assert.True(jsonSchema.GetProperty("strict").GetBoolean());
        Assert.False(jsonSchema.GetProperty("schema").GetProperty("additionalProperties").GetBoolean());
        var itemSchema = jsonSchema.GetProperty("schema").GetProperty("properties").GetProperty("suggestions")
            .GetProperty("items");
        Assert.False(itemSchema.GetProperty("additionalProperties").GetBoolean());
        Assert.Contains(itemSchema.GetProperty("required").EnumerateArray(), item => item.GetString() == "rationale");
        Assert.DoesNotContain("confidence", requestBody!, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("chain-of-thought", root.GetProperty("messages")[1].GetProperty("content").GetString()!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("not-json")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v1\",\"suggestions\":[{\"issueKey\":\"level-type:0\",\"kind\":\"organization_type_mapping\",\"targetKey\":\"type:11111111-1111-1111-1111-111111111111\"}]}")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v1\",\"suggestions\":[],\"unexpected\":true}")]
    public async Task MalformedOrSchemaInvalidStructuredDocumentMapsToInvalidOutput(string structured)
    {
        var provider = Provider(new DelegateHandler((_, _) => Task.FromResult(Json(HttpStatusCode.OK, new
        {
            choices = new[] { new { message = new { content = structured } } },
        }))));

        var exception = await Assert.ThrowsAsync<OrganizationImportSemanticProviderException>(
            () => provider.SuggestAsync(Request(), CancellationToken.None));

        Assert.Equal(OrganizationImportSemanticFailureCategory.InvalidOutput, exception.Category);
    }

    [Fact]
    public async Task RateLimitMapsSafeCategoryAndRetryAfterWithoutRetrying()
    {
        var calls = 0;
        var provider = Provider(new DelegateHandler((_, _) =>
        {
            calls++;
            var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
            response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30));
            return Task.FromResult(response);
        }));

        var exception = await Assert.ThrowsAsync<OrganizationImportSemanticProviderException>(
            () => provider.SuggestAsync(Request(), CancellationToken.None));

        Assert.Equal(OrganizationImportSemanticFailureCategory.RateLimited, exception.Category);
        Assert.NotNull(exception.RetryAfter);
        Assert.Equal(1, calls);
        Assert.DoesNotContain("Groq", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ProviderErrorMapsToSafeUnavailableCategory()
    {
        var provider = Provider(new DelegateHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError))));

        var exception = await Assert.ThrowsAsync<OrganizationImportSemanticProviderException>(
            () => provider.SuggestAsync(Request(), CancellationToken.None));

        Assert.Equal(OrganizationImportSemanticFailureCategory.ProviderUnavailable, exception.Category);
        Assert.DoesNotContain("500", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static GroqOrganizationImportSemanticProvider Provider(HttpMessageHandler handler)
    {
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.groq.com/openai/v1/") };
        return new(client, new OrganizationImportSemanticAssistanceOptions { ApiKey = "test-secret" });
    }

    private static OrganizationImportSemanticRequest Request()
    {
        var typeId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        return new(
            OrganizationImportSemanticAssistanceOptions.DefaultContractVersion,
            "source-fingerprint",
            [new("level-type:0", OrganizationImportSemanticKinds.OrganizationTypeMapping, 0, "Entity", [new($"type:{typeId}", "Organization")])],
            [new(0, "Entity", ["Asteria"], 1, 1)],
            [new(typeId, "Organization")],
            new(1, 1, true, ["LevelColumns"]),
            [new("Entity", 1, 0, 0, [], [], true, false, ["Asteria"])],
            [new("Organization", "Enterprise/root organizational body.")],
            new string('f', 64));
    }

    private static HttpResponseMessage Json(HttpStatusCode status, object body)
        => new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };

    private sealed class DelegateHandler(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => send(request, cancellationToken);
    }
}
