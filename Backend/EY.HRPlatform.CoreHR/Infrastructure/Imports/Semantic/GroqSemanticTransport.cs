using System.Text.Json;
using EY.HRPlatform.SharedKernel.Ai;
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
/// The import domains' classification call on the shared <see cref="GroqStructuredTransport"/>: a
/// strict schema enumerating only the questions and targets Fusion allows, Suggest-or-Abstain
/// answers, and the shared failure categories under the import's own names and wording. Exactly one
/// call; retries and budgets belong to <see cref="ImportSemanticRunner"/>. What a question means and
/// which evidence it carries stay with the domain provider.
/// </summary>
public static class GroqSemanticTransport
{
    private static readonly JsonSerializerOptions StructuredJson = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) },
    };

    private static readonly AiSafeMessages Messages = new(
        "Automatic matching is temporarily unavailable.",
        "Automatic matching is not authorized.",
        "Automatic matching is unavailable right now.",
        "Automatic matching could not be used with the current configuration.",
        "Automatic matching returned an unusable result.");

    public static async Task<ImportSemanticProviderResult> AskAsync(
        HttpClient httpClient,
        GroqSemanticAsk ask,
        CancellationToken cancellationToken)
    {
        AiStructuredResult result;
        try
        {
            result = await GroqStructuredTransport.CompleteAsync(
                httpClient,
                new GroqStructuredRequest(
                    ask.ApiKey,
                    ask.Model,
                    ask.Instructions,
                    ask.Input,
                    ask.SchemaName,
                    CreateSchema(ask),
                    ask.MaxCompletionTokens,
                    ask.ReasoningEffort),
                cancellationToken,
                Messages);
        }
        catch (AiProviderException exception)
        {
            throw Translate(exception);
        }

        StructuredAnswerDocument document;
        try
        {
            document = result.Read<StructuredAnswerDocument>(StructuredJson, Messages.InvalidOutput);
        }
        catch (AiProviderException exception)
        {
            throw Translate(exception);
        }
        if (!string.Equals(document.ContractVersion, ask.ResultContractVersion, StringComparison.Ordinal)
            || document.Answers is null
            || document.Answers.Count > ask.Questions.Count
            || !MatchesSchemaEnums(document.Answers, ask.Questions))
            throw InvalidOutput();
        return new ImportSemanticProviderResult(
            document.Answers
                .Select(item => new ImportSemanticAnswer(item.QuestionKey, item.Disposition, item.TargetKey))
                .ToList(),
            result.InputTokens,
            result.OutputTokens,
            result.ResponseId,
            result.SystemFingerprint);
    }

    /// <summary>The shared categories carry the same names as the import's persisted ones.</summary>
    private static ImportSemanticProviderException Translate(AiProviderException exception)
        => new(
            Enum.Parse<ImportSemanticFailureCategory>(exception.Category.ToString()),
            exception.Message,
            exception.RetryAfter,
            exception.InnerException);

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
}
