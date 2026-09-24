using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public sealed class OrganizationImportSemanticAssistanceOptions
{
    public const string SectionName = "OrganizationImport:SemanticAssistance";
    public const string DefaultProvider = "Groq";
    public const string DefaultModel = "openai/gpt-oss-120b";
    public const string DefaultEndpoint = "https://api.groq.com/openai/v1";

    public bool Enabled { get; set; } = true;
    /// <summary>
    /// How external processing is allowed. Switch with
    /// <c>OrganizationImport__SemanticAssistance__ConsentMode</c> and restart CoreHR.
    /// </summary>
    public OrganizationImportSemanticConsentMode ConsentMode { get; set; } = OrganizationImportSemanticConsentMode.Implicit;
    public string Provider { get; set; } = DefaultProvider;
    /// <summary>The single pinned model. There is no fallback routing: an unavailable model means manual Match.</summary>
    public string Model { get; set; } = DefaultModel;
    public string Endpoint { get; set; } = DefaultEndpoint;
    /// <summary>Upper bound for one provider call.</summary>
    public int TimeoutSeconds { get; set; } = 20;
    /// <summary>Total time a run may take while the upload waits, retries included.</summary>
    public int UploadBudgetSeconds { get; set; } = 20;
    /// <summary>Total time a run may take when the administrator starts it from Match.</summary>
    public int InteractiveBudgetSeconds { get; set; } = 30;
    /// <summary>Bounded retries after the first call, for transient provider failures only.</summary>
    public int MaxRetries { get; set; } = 1;
    public int MaxFields { get; set; } = 32;
    public int MaxValuesPerField { get; set; } = 5;
    public int MaxTotalValues { get; set; } = 64;
    public int MaxValueCharacters { get; set; } = 120;
    public int MaxPayloadBytes { get; set; } = 20 * 1024;
    public string? ApiKey { get; set; }
}

/// <summary>
/// The three versions that govern a semantic run. Each one is recorded on every attempt.
/// </summary>
public static class OrganizationImportSemanticVersions
{
    /// <summary>What data leaves Fusion: evidence fields, sample budget, redaction. Tenant consent binds to it; bump it and consent is asked again.</summary>
    public const string DataContract = "organization-import-semantic-data/1";

    /// <summary>The structured result schema the provider must return.</summary>
    public const string ResultContract = "organization-import-semantics/v2";

    /// <summary>The static provider instructions. Bump on any meaningful prompt change.</summary>
    public const string Prompt = "organization-import-semantic-prompt/2";
}

/// <summary>
/// Semantic assistance as the product sees it. Deliberately independent of Match readiness:
/// a successful run can leave questions open, and a failed one never blocks manual Match.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticAssistanceState
{
    /// <summary>Deterministic interpretation left no semantic question.</summary>
    NotNeeded,
    /// <summary>Questions exist, but the tenant has not allowed external processing.</summary>
    AwaitingConsent,
    /// <summary>Questions exist and a run is allowed, but none has been made for them.</summary>
    Ready,
    Running,
    /// <summary>The provider answered and Fusion applied what passed validation. Abstentions are part of success.</summary>
    Succeeded,
    Failed,
    /// <summary>New questions appeared after the last successful run.</summary>
    Stale,
    /// <summary>Questions exist but assistance cannot run here (not configured, or the evidence exceeds the payload budget).</summary>
    Skipped,
}

/// <summary>How consent to external semantic processing is obtained.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticConsentMode
{
    /// <summary>An administrator allows it once for the tenant; later uploads run automatically.</summary>
    Tenant,
    /// <summary>Every import asks; consent covers that import only and uploads never run on their own.</summary>
    PerImport,
    /// <summary>Never asks; every upload runs automatic matching. The default.</summary>
    Implicit,
}

/// <summary>What granting consent from Match would cover, so the prompt can say so truthfully.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticConsentScope
{
    Tenant,
    Import,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticAttemptStatus
{
    Running,
    Succeeded,
    Failed,
    Stale,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticFailureCategory
{
    NotConfigured,
    Unauthorized,
    ProviderRejected,
    Timeout,
    RateLimited,
    ProviderUnavailable,
    InvalidOutput,
    Interrupted,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticTrigger
{
    Upload,
    Administrator,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrganizationImportSemanticDisposition
{
    Suggest,
    Abstain,
}

public static class OrganizationImportSemanticKinds
{
    public const string SourceShape = "source_shape";
    public const string FieldMapping = "field_mapping";
    public const string OrganizationTypeMapping = "organization_type_mapping";
}

public sealed record OrganizationImportSemanticTarget(string Key, string Label);

/// <summary>One unresolved semantic question and the exact targets Fusion allows as its answer.</summary>
public sealed record OrganizationImportSemanticIssue(
    string Key,
    string Kind,
    int? SourceColumnIndex,
    string? SourceLabel,
    IReadOnlyList<OrganizationImportSemanticTarget> AllowedTargets);

public sealed record OrganizationImportSemanticFieldContext(
    int ColumnIndex,
    string SourceLabel,
    int NonEmptyCount,
    int DistinctCount,
    decimal NonEmptyRate,
    string BasicValueShape,
    IReadOnlyList<string> RepresentativeValues);

public sealed record OrganizationImportSemanticStructuralContext(
    int RowCount,
    int ColumnCount,
    bool HasOrderedLevelPattern,
    IReadOnlyList<string> PlausibleShapes);

/// <summary>
/// Per-source-type structural evidence: what role a source type label plays in the uploaded
/// hierarchy. Labels, counts, depths and neighbour type labels only; never unit names.
/// </summary>
public sealed record OrganizationImportSemanticSourceType(
    string SourceLabel,
    int Occurrences,
    int MinDepth,
    int MaxDepth,
    IReadOnlyList<string> ParentTypes,
    IReadOnlyList<string> ChildTypes,
    bool OccursOnRoot,
    bool LeafOnly);

/// <summary>A canonical Fusion type and a short description of the organizational role it represents.</summary>
public sealed record OrganizationImportSemanticCanonicalType(string Name, string Description);

/// <summary>The bounded semantic input for one run: every open question, plus only the evidence they need.</summary>
public sealed record OrganizationImportSemanticRequest(
    string ResultContractVersion,
    string SourceFingerprint,
    IReadOnlyList<OrganizationImportSemanticIssue> Issues,
    IReadOnlyList<OrganizationImportSemanticFieldContext> Fields,
    IReadOnlyList<OrganizationImportTypeOption> OrganizationTypes,
    OrganizationImportSemanticStructuralContext Structure,
    IReadOnlyList<OrganizationImportSemanticSourceType> SourceTypeSystem,
    IReadOnlyList<OrganizationImportSemanticCanonicalType> CanonicalTypeGuidance,
    string InputFingerprint);

/// <summary>What the context builder concluded: a request to send, or why there is none.</summary>
public sealed record OrganizationImportSemanticContext(
    OrganizationImportSemanticRequest? Request,
    bool ExceedsPayloadBudget)
{
    public static OrganizationImportSemanticContext NoQuestions { get; } = new(null, false);
    public static OrganizationImportSemanticContext OverBudget { get; } = new(null, true);
}

/// <summary>One answer per question: a target from the allowed list, or an explicit abstention.</summary>
public sealed record OrganizationImportSemanticAnswer(
    string QuestionKey,
    OrganizationImportSemanticDisposition Disposition,
    string? TargetKey);

public sealed record OrganizationImportSemanticProviderResult(
    IReadOnlyList<OrganizationImportSemanticAnswer> Answers,
    int? InputTokens,
    int? OutputTokens,
    string? ResponseId = null,
    string? SystemFingerprint = null);

public interface IOrganizationImportSemanticProvider
{
    string ProviderName { get; }
    string ModelName { get; }
    bool IsConfigured { get; }

    /// <summary>Exactly one provider call. Retries belong to the caller, which owns the time budget.</summary>
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
    public bool Retryable => OrganizationImportSemanticFailures.IsTransient(Category);
}

public static class OrganizationImportSemanticFailures
{
    /// <summary>Failures worth another attempt: the provider may answer next time. Configuration and credential failures will not.</summary>
    public static bool IsTransient(OrganizationImportSemanticFailureCategory category)
        => category is OrganizationImportSemanticFailureCategory.Timeout
            or OrganizationImportSemanticFailureCategory.RateLimited
            or OrganizationImportSemanticFailureCategory.ProviderUnavailable
            or OrganizationImportSemanticFailureCategory.InvalidOutput
            or OrganizationImportSemanticFailureCategory.Interrupted;
}

/// <summary>
/// The product-level truth about semantic assistance for one import. The UI never has to infer
/// whether AI ran, and never sees provider internals.
/// </summary>
public sealed record OrganizationImportSemanticAssistanceDto(
    OrganizationImportSemanticAssistanceState State,
    string? InputFingerprint,
    int ExaminedCount,
    int AppliedCount,
    int AbstainedCount,
    int RemainingCount,
    DateTime? LastCompletedAt,
    bool CanRetry,
    DateTime? RetryAfter,
    OrganizationImportSemanticFailureCategory? FailureCategory,
    OrganizationImportSemanticConsentScope ConsentScope = OrganizationImportSemanticConsentScope.Tenant)
{
    public static OrganizationImportSemanticAssistanceDto Of(
        OrganizationImportSemanticAssistanceState state,
        string? inputFingerprint,
        int remaining)
        => new(state, inputFingerprint, 0, 0, 0, remaining, null, false, null, null);
}

/// <summary>Starts a run from Match: the first time (granting tenant consent) or after a retryable failure.</summary>
public sealed record RunOrganizationImportSemanticAssistanceRequest(
    string InputFingerprint,
    bool GrantTenantConsent = false);

/// <summary>A validated suggestion that was written into the Mapping Plan, kept for provenance and override tracking.</summary>
public sealed record OrganizationImportAppliedSuggestion(
    string QuestionKey,
    string Kind,
    string TargetKey,
    string? SourceLabel);

public interface IOrganizationImportSemanticAssistanceService
{
    Task<OrganizationImportSemanticAssistanceDto> DescribeAsync(
        OrganizationImportSession session,
        OrganizationImportInterpretation review,
        CancellationToken cancellationToken);

    /// <summary>
    /// Runs assistance right after upload when it is needed and allowed, inside the upload budget.
    /// Never throws: upload success never depends on the provider.
    /// </summary>
    Task RunAfterUploadAsync(Guid sessionId, OrganizationImportActor actor, CancellationToken cancellationToken);

    /// <summary>An administrator-started run from Match, optionally granting tenant consent first.</summary>
    Task RunAsync(
        Guid sessionId,
        RunOrganizationImportSemanticAssistanceRequest request,
        OrganizationImportActor actor,
        CancellationToken cancellationToken);

    /// <summary>
    /// Counts administrator changes to mappings that semantic assistance supplied. The caller
    /// saves the change together with its own decision update.
    /// </summary>
    Task RecordOverridesAsync(Guid sessionId, int overriddenCount, CancellationToken cancellationToken);
}
