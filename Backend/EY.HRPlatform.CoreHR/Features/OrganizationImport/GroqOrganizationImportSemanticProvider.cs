using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public sealed class GroqOrganizationImportSemanticProvider(
    HttpClient httpClient,
    OrganizationImportSemanticAssistanceOptions options) : IOrganizationImportSemanticProvider
{
    private static readonly JsonSerializerOptions EnvelopeJson = new(JsonSerializerDefaults.Web);
    private static readonly JsonSerializerOptions StructuredJson = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    public string ProviderName => options.Provider;
    public string ModelName => options.Model;
    public bool IsConfigured => options.Enabled && !string.IsNullOrWhiteSpace(options.ApiKey);

    public async Task<OrganizationImportSemanticProviderResult> SuggestAsync(
        OrganizationImportSemanticRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
            throw new OrganizationImportSemanticProviderException(
                OrganizationImportSemanticFailureCategory.NotConfigured,
                "Suggestions are unavailable. Continue with manual review.");

        var providerInput = new
        {
            request.ContractVersion,
            issues = request.Issues.Select(issue => new
            {
                issueKey = issue.Key,
                issue.Kind,
                source = issue.SourceColumnIndex is int columnIndex
                    ? request.Fields.Where(field => field.ColumnIndex == columnIndex).Select(field => new
                    {
                        field.ColumnIndex,
                        field.SourceLabel,
                        field.RepresentativeValues,
                        field.NonEmptyCount,
                        field.DistinctCount,
                    }).SingleOrDefault()
                    : null,
                allowedTargets = issue.AllowedTargets,
            }),
            organizationTypes = request.OrganizationTypes,
            request.Structure,
            sourceTypeSystem = request.SourceTypeSystem,
            canonicalTypeGuidance = request.CanonicalTypeGuidance,
        };
        var body = new
        {
            model = options.Model,
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Map unfamiliar organization-import vocabulary to the exact allowed targets. "
                        + "For organization type mappings, interpret the source type SYSTEM AS A WHOLE, not each label alone: "
                        + "use both the vocabulary AND the provided topology in sourceTypeSystem — occurrences, min/max depth, "
                        + "parentTypes, childTypes, whether it occurs on the root, and whether it is leaf-only — and align each "
                        + "source type to the canonical role in canonicalTypeGuidance that best fits its meaning and its position "
                        + "in the hierarchy. The single source type that occurs on the structural root (occursOnRoot=true, the "
                        + "shallowest depth) is the enterprise top and maps to the canonical Organization; a source type that does "
                        + "NOT occur on the root must never map to Organization. Preserve the source's top-to-bottom order: a deeper "
                        + "source type maps to a canonical role at the same or a deeper level than every shallower source type, never "
                        + "a shallower one. Produce a coherent whole-taxonomy mapping where distinct roles map to distinct canonical "
                        + "types in that top-to-bottom order. Return only useful suggestions. "
                        + "Never invent units, identities, relationships, codes, roots, or types. Never map a field to Fusion OrgUnit ID. "
                        + "Rationale must be null or one short business-readable sentence. Do not provide hidden reasoning or chain-of-thought.",
                },
                new
                {
                    role = "user",
                    content = JsonSerializer.Serialize(providerInput),
                },
            },
            temperature = 0.1,
            // This is a bounded classification task, not open-ended generation. Low reasoning effort
            // keeps the mapping quality while cutting the hidden reasoning tokens (and the per-request
            // token reservation) so both the field and type calls comfortably fit the provider's
            // tokens-per-minute budget instead of throttling the second (type) call. The ordering the
            // model must respect is carried by the system prompt; a deterministic guard withholds the
            // one mistake low effort still makes (a non-root level landing on the Organization type).
            max_completion_tokens = 800,
            reasoning_effort = "low",
            stream = false,
            response_format = new
            {
                type = "json_schema",
                json_schema = new
                {
                    name = "organization_import_semantic_suggestions",
                    strict = true,
                    schema = CreateSchema(request),
                },
            },
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = JsonContent.Create(body),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey!.Trim());
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
            var document = JsonSerializer.Deserialize<StructuredSuggestionDocument>(content, StructuredJson);
            if (document is null
                || !string.Equals(document.ContractVersion, request.ContractVersion, StringComparison.Ordinal)
                || document.Suggestions is null
                || document.Suggestions.Count > request.Issues.Count
                || !MatchesSchemaEnums(document.Suggestions, request))
                throw InvalidOutput();
            return new OrganizationImportSemanticProviderResult(
                document.Suggestions
                    .Select(item => new OrganizationImportSemanticProviderSuggestion(
                        item.IssueKey,
                        item.Kind,
                        item.TargetKey,
                        item.Rationale))
                    .ToList(),
                envelope?.Usage?.PromptTokens,
                envelope?.Usage?.CompletionTokens);
        }
        catch (JsonException exception)
        {
            throw InvalidOutput(exception);
        }
    }

    private static bool MatchesSchemaEnums(
        IReadOnlyList<StructuredSuggestion> suggestions,
        OrganizationImportSemanticRequest request)
    {
        var issueKeys = request.Issues.Select(issue => issue.Key).ToHashSet(StringComparer.Ordinal);
        var kinds = request.Issues.Select(issue => issue.Kind).ToHashSet(StringComparer.Ordinal);
        var targetKeys = request.Issues.SelectMany(issue => issue.AllowedTargets).Select(target => target.Key)
            .ToHashSet(StringComparer.Ordinal);
        return suggestions.All(item =>
            !string.IsNullOrWhiteSpace(item.IssueKey)
            && !string.IsNullOrWhiteSpace(item.Kind)
            && !string.IsNullOrWhiteSpace(item.TargetKey)
            && issueKeys.Contains(item.IssueKey)
            && kinds.Contains(item.Kind)
            && targetKeys.Contains(item.TargetKey)
            && (item.Rationale is null || item.Rationale.Length <= 180));
    }

    private static object CreateSchema(OrganizationImportSemanticRequest request)
    {
        var issueKeys = request.Issues.Select(issue => issue.Key).Distinct(StringComparer.Ordinal).ToArray();
        var kinds = request.Issues.Select(issue => issue.Kind).Distinct(StringComparer.Ordinal).ToArray();
        var targetKeys = request.Issues.SelectMany(issue => issue.AllowedTargets).Select(target => target.Key)
            .Distinct(StringComparer.Ordinal).ToArray();
        return new
        {
            type = "object",
            properties = new
            {
                contractVersion = new { type = "string", @enum = new[] { request.ContractVersion } },
                suggestions = new
                {
                    type = "array",
                    maxItems = request.Issues.Count,
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            issueKey = new { type = "string", @enum = issueKeys },
                            kind = new { type = "string", @enum = kinds },
                            targetKey = new { type = "string", @enum = targetKeys },
                            rationale = new { type = new[] { "string", "null" }, maxLength = 180 },
                        },
                        required = new[] { "issueKey", "kind", "targetKey", "rationale" },
                        additionalProperties = false,
                    },
                },
            },
            required = new[] { "contractVersion", "suggestions" },
            additionalProperties = false,
        };
    }

    private static OrganizationImportSemanticProviderException FailureFor(HttpResponseMessage response)
    {
        if (response.StatusCode == HttpStatusCode.TooManyRequests)
            return new OrganizationImportSemanticProviderException(
                OrganizationImportSemanticFailureCategory.RateLimited,
                "Suggestions are temporarily unavailable. Continue manually or retry later.",
                RetryAfter(response));
        return new OrganizationImportSemanticProviderException(
            OrganizationImportSemanticFailureCategory.ProviderUnavailable,
            "Suggestions are unavailable right now. Continue with manual review.");
    }

    private static DateTime? RetryAfter(HttpResponseMessage response)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta)
            return DateTime.UtcNow.Add(delta > TimeSpan.Zero ? delta : TimeSpan.Zero);
        return response.Headers.RetryAfter?.Date?.UtcDateTime;
    }

    private static OrganizationImportSemanticProviderException InvalidOutput(Exception? innerException = null)
        => new(
            OrganizationImportSemanticFailureCategory.InvalidOutput,
            "Suggestions could not be used. Continue with manual review or retry.",
            innerException: innerException);

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    private sealed class StructuredSuggestionDocument
    {
        [JsonRequired]
        public string ContractVersion { get; init; } = string.Empty;

        [JsonRequired]
        public List<StructuredSuggestion> Suggestions { get; init; } = [];
    }

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    private sealed class StructuredSuggestion
    {
        [JsonRequired]
        public string IssueKey { get; init; } = string.Empty;

        [JsonRequired]
        public string Kind { get; init; } = string.Empty;

        [JsonRequired]
        public string TargetKey { get; init; } = string.Empty;

        [JsonRequired]
        public string? Rationale { get; init; }
    }

    private sealed class GroqChatResponse
    {
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
