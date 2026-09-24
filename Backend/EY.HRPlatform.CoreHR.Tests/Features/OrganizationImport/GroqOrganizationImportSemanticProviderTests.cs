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
                contractVersion = OrganizationImportSemanticVersions.ResultContract,
                answers = new object[]
                {
                    new
                    {
                        questionKey = "level-type:0",
                        disposition = "suggest",
                        targetKey = $"type:{Guid.Parse("11111111-1111-1111-1111-111111111111")}",
                    },
                    new { questionKey = "type-value:abc", disposition = "abstain", targetKey = (string?)null },
                },
            });
            return Json(HttpStatusCode.OK, new
            {
                id = "chatcmpl-demo",
                system_fingerprint = "fp_demo",
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
        Assert.Equal(("chatcmpl-demo", "fp_demo"), (result.ResponseId, result.SystemFingerprint));
        Assert.Equal(2, result.Answers.Count);
        Assert.Equal(OrganizationImportSemanticDisposition.Suggest, result.Answers[0].Disposition);
        Assert.Equal(OrganizationImportSemanticDisposition.Abstain, result.Answers[1].Disposition);
        Assert.Null(result.Answers[1].TargetKey);
        using var body = JsonDocument.Parse(requestBody!);
        var root = body.RootElement;
        Assert.Equal(OrganizationImportSemanticAssistanceOptions.DefaultModel, root.GetProperty("model").GetString());
        Assert.False(root.GetProperty("stream").GetBoolean());
        Assert.False(root.TryGetProperty("tools", out _));
        Assert.Equal("json_schema", root.GetProperty("response_format").GetProperty("type").GetString());
        var jsonSchema = root.GetProperty("response_format").GetProperty("json_schema");
        Assert.True(jsonSchema.GetProperty("strict").GetBoolean());
        Assert.False(jsonSchema.GetProperty("schema").GetProperty("additionalProperties").GetBoolean());
        var itemSchema = jsonSchema.GetProperty("schema").GetProperty("properties").GetProperty("answers")
            .GetProperty("items");
        Assert.False(itemSchema.GetProperty("additionalProperties").GetBoolean());
        Assert.Equal(["suggest", "abstain"], itemSchema.GetProperty("properties").GetProperty("disposition").GetProperty("enum")
            .EnumerateArray().Select(item => item.GetString()));
        Assert.DoesNotContain("confidence", requestBody!, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("rationale", requestBody!, StringComparison.OrdinalIgnoreCase);
        var instructions = root.GetProperty("messages")[0].GetProperty("content").GetString()!;
        Assert.Contains("abstain", instructions, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("untrusted data", instructions, StringComparison.OrdinalIgnoreCase);
        // Evidence per question: header, samples and statistics, never whole rows.
        var input = JsonDocument.Parse(root.GetProperty("messages")[1].GetProperty("content").GetString()!).RootElement;
        var column = input.GetProperty("questions")[0].GetProperty("column");
        Assert.Equal("Asteria", column.GetProperty("sampleValues")[0].GetString());
        Assert.True(column.TryGetProperty("valueShape", out _));
    }

    [Theory]
    [InlineData("not-json")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v1\",\"answers\":[]}")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v2\",\"answers\":[{\"questionKey\":\"level-type:0\",\"disposition\":\"suggest\"}]}")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v2\",\"answers\":[{\"questionKey\":\"level-type:0\",\"disposition\":\"guess\",\"targetKey\":null}]}")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v2\",\"answers\":[{\"questionKey\":\"level-type:0\",\"disposition\":\"suggest\",\"targetKey\":\"type:invented\"}]}")]
    [InlineData("{\"contractVersion\":\"organization-import-semantics/v2\",\"answers\":[],\"unexpected\":true}")]
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

    [Theory]
    [InlineData(401, OrganizationImportSemanticFailureCategory.Unauthorized, false)]
    [InlineData(403, OrganizationImportSemanticFailureCategory.Unauthorized, false)]
    [InlineData(404, OrganizationImportSemanticFailureCategory.ProviderRejected, false)]
    [InlineData(498, OrganizationImportSemanticFailureCategory.ProviderUnavailable, true)]
    [InlineData(503, OrganizationImportSemanticFailureCategory.ProviderUnavailable, true)]
    public async Task HttpFailuresAreClassifiedForTheRetryPolicy(int status, OrganizationImportSemanticFailureCategory category, bool retryable)
    {
        var provider = Provider(new DelegateHandler((_, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status))));

        var exception = await Assert.ThrowsAsync<OrganizationImportSemanticProviderException>(
            () => provider.SuggestAsync(Request(), CancellationToken.None));

        Assert.Equal(category, exception.Category);
        Assert.Equal(retryable, exception.Retryable);
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
            OrganizationImportSemanticVersions.ResultContract,
            "source-fingerprint",
            [
                new("level-type:0", OrganizationImportSemanticKinds.OrganizationTypeMapping, 0, "Entity", [new($"type:{typeId}", "Organization")]),
                new("type-value:abc", OrganizationImportSemanticKinds.OrganizationTypeMapping, null, "Squad", [new($"type:{typeId}", "Organization")]),
            ],
            [new(0, "Entity", 1, 1, 1m, "identifier-or-label", ["Asteria"])],
            [new(typeId, "Organization")],
            new(1, 1, true, ["LevelColumns"]),
            [new("Entity", 1, 0, 0, [], [], true, false)],
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
