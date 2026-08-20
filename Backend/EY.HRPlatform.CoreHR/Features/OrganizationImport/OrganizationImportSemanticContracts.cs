using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public sealed class OrganizationImportSemanticAssistanceOptions
{
    public const string SectionName = "OrganizationImport:SemanticAssistance";
    public const string DefaultProvider = "Groq";
    public const string DefaultModel = "openai/gpt-oss-120b";
    public const string DefaultEndpoint = "https://api.groq.com/openai/v1";
    public const string DefaultContractVersion = "organization-import-semantics/v1";

    public bool Enabled { get; set; } = true;
    public string Provider { get; set; } = DefaultProvider;
    public string Model { get; set; } = DefaultModel;
    public string Endpoint { get; set; } = DefaultEndpoint;
    public int TimeoutSeconds { get; set; } = 20;
    public int MaxFields { get; set; } = 32;
    public int MaxValuesPerField { get; set; } = 8;
    public int MaxTotalValues { get; set; } = 64;
    public int MaxValueCharacters { get; set; } = 120;
    public int MaxPayloadBytes { get; set; } = 20 * 1024;
    public int MaxRationaleCharacters { get; set; } = 180;
    public string ContractVersion { get; set; } = DefaultContractVersion;
    public string? ApiKey { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticAssistanceState
{
    NotEligible,
    Eligible,
    Pending,
    Available,
    Failed,
    Applied,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticAttemptStatus
{
    Pending,
    Available,
    Failed,
    Applied,
    Superseded,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticFailureCategory
{
    NotConfigured,
    Timeout,
    RateLimited,
    ProviderUnavailable,
    InvalidOutput,
    Interrupted,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticReviewOutcome
{
    Accepted,
    Changed,
    Rejected,
}

public static class OrganizationImportSemanticKinds
{
    public const string SourceShape = "source_shape";
    public const string FieldMapping = "field_mapping";
    public const string OrganizationTypeMapping = "organization_type_mapping";
}

public sealed record OrganizationImportSemanticTarget(string Key, string Label);

public sealed record OrganizationImportSemanticIssue(
    string Key,
    string Kind,
    int? SourceColumnIndex,
    string? SourceLabel,
    IReadOnlyList<OrganizationImportSemanticTarget> AllowedTargets);

public sealed record OrganizationImportSemanticFieldContext(
    int ColumnIndex,
    string SourceLabel,
    IReadOnlyList<string> RepresentativeValues,
    int NonEmptyCount,
    int DistinctCount);

public sealed record OrganizationImportSemanticStructuralContext(
    int RowCount,
    int ColumnCount,
    bool HasOrderedLevelPattern,
    IReadOnlyList<string> PlausibleShapes);

/// <summary>
/// Per-source-type structural evidence: what role a source type label actually plays in the uploaded
/// hierarchy. Lets the semantic model reason about the type SYSTEM (vocabulary + topology) instead of
/// classifying each label in isolation. PII-free — labels, counts, depths, and neighbour type labels.
/// </summary>
public sealed record OrganizationImportSemanticSourceType(
    string SourceLabel,
    int Occurrences,
    int MinDepth,
    int MaxDepth,
    IReadOnlyList<string> ParentTypes,
    IReadOnlyList<string> ChildTypes,
    bool OccursOnRoot,
    bool LeafOnly,
    IReadOnlyList<string> SampleNames);

/// <summary>A canonical Fusion type and a short description of the organizational role it represents.</summary>
public sealed record OrganizationImportSemanticCanonicalType(string Name, string Description);

public sealed record OrganizationImportSemanticRequest(
    string ContractVersion,
    string SourceFingerprint,
    IReadOnlyList<OrganizationImportSemanticIssue> Issues,
    IReadOnlyList<OrganizationImportSemanticFieldContext> Fields,
    IReadOnlyList<OrganizationImportTypeOption> OrganizationTypes,
    OrganizationImportSemanticStructuralContext Structure,
    IReadOnlyList<OrganizationImportSemanticSourceType> SourceTypeSystem,
    IReadOnlyList<OrganizationImportSemanticCanonicalType> CanonicalTypeGuidance,
    string InputFingerprint);

public sealed record OrganizationImportSemanticProviderSuggestion(
    string IssueKey,
    string Kind,
    string TargetKey,
    string? Rationale);

public sealed record OrganizationImportSemanticProviderResult(
    IReadOnlyList<OrganizationImportSemanticProviderSuggestion> Suggestions,
    int? InputTokens,
    int? OutputTokens);

public interface IOrganizationImportSemanticProvider
{
    string ProviderName { get; }
    string ModelName { get; }
    bool IsConfigured { get; }

    Task<OrganizationImportSemanticProviderResult> SuggestAsync(
        OrganizationImportSemanticRequest request,
        CancellationToken cancellationToken);
}

public sealed class OrganizationImportSemanticProviderException(
    OrganizationImportSemanticFailureCategory category,
    string safeMessage,
    DateTime? retryAfter = null,
    Exception? innerException = null) : Exception(safeMessage, innerException)
{
    public OrganizationImportSemanticFailureCategory Category { get; } = category;
    public DateTime? RetryAfter { get; } = retryAfter;
}

public sealed record OrganizationImportSemanticSuggestionDto(
    string IssueKey,
    string Kind,
    int? SourceColumnIndex,
    string? SourceLabel,
    string TargetKey,
    string TargetLabel,
    string? Rationale,
    IReadOnlyList<OrganizationImportSemanticTarget> AllowedTargets);

public sealed record OrganizationImportSemanticAssistanceDto(
    OrganizationImportSemanticAssistanceState State,
    string? InputFingerprint,
    Guid? AttemptId,
    int? AttemptVersion,
    string? Provider,
    string? Model,
    DateTime? RequestedAt,
    DateTime? CompletedAt,
    OrganizationImportSemanticFailureCategory? FailureCategory,
    DateTime? RetryAfter,
    IReadOnlyList<OrganizationImportSemanticSuggestionDto> Suggestions)
{
    public static OrganizationImportSemanticAssistanceDto NotEligible()
        => new(OrganizationImportSemanticAssistanceState.NotEligible, null, null, null, null, null, null, null, null, null, []);

    public static OrganizationImportSemanticAssistanceDto Eligible(string fingerprint)
        => new(OrganizationImportSemanticAssistanceState.Eligible, fingerprint, null, null, null, null, null, null, null, null, []);
}

public sealed record GenerateOrganizationImportSemanticSuggestionsRequest(string InputFingerprint, bool Retry = false);

public sealed record OrganizationImportSemanticReviewedItem(
    string IssueKey,
    string? TargetKey,
    OrganizationImportSemanticReviewOutcome Outcome);

public sealed record ApplyOrganizationImportSemanticSuggestionsRequest(
    string InputFingerprint,
    int AttemptVersion,
    IReadOnlyList<OrganizationImportSemanticReviewedItem> ReviewedItems);

public sealed record OrganizationImportSemanticReviewRecord(
    string IssueKey,
    string? SuggestedTargetKey,
    string? AppliedTargetKey,
    OrganizationImportSemanticReviewOutcome Outcome);

public interface IOrganizationImportSemanticAssistanceService
{
    Task<OrganizationImportSemanticAssistanceDto> DescribeAsync(
        OrganizationImportSession session,
        OrganizationImportReview review,
        CancellationToken cancellationToken);

    Task<OrganizationImportSemanticAssistanceDto> GenerateAsync(
        Guid sessionId,
        GenerateOrganizationImportSemanticSuggestionsRequest request,
        CancellationToken cancellationToken);

    Task ApplyAsync(
        Guid sessionId,
        Guid attemptId,
        uint expectedSessionVersion,
        ApplyOrganizationImportSemanticSuggestionsRequest request,
        OrganizationImportActor actor,
        CancellationToken cancellationToken);
}
