using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
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
    public ImportSemanticConsentMode ConsentMode { get; set; } = ImportSemanticConsentMode.Implicit;
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

public static class OrganizationImportSemanticKinds
{
    public const string SourceShape = "source_shape";
    public const string FieldMapping = "field_mapping";
    public const string OrganizationTypeMapping = "organization_type_mapping";
}

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
    IReadOnlyList<ImportSemanticIssue> Issues,
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

public interface IOrganizationImportSemanticProvider
{
    string ProviderName { get; }
    string ModelName { get; }
    bool IsConfigured { get; }

    /// <summary>Exactly one provider call. Retries belong to the caller, which owns the time budget.</summary>
    Task<ImportSemanticProviderResult> SuggestAsync(
        OrganizationImportSemanticRequest request,
        CancellationToken cancellationToken);
}

public interface IOrganizationImportSemanticAssistanceService
{
    Task<ImportSemanticAssistanceDto> DescribeAsync(
        OrganizationImportSession session,
        OrganizationImportInterpretation review,
        CancellationToken cancellationToken);

    /// <summary>
    /// Runs assistance right after upload when it is needed and allowed, inside the upload budget.
    /// Never throws: upload success never depends on the provider.
    /// </summary>
    Task RunAfterUploadAsync(Guid sessionId, ImportActor actor, CancellationToken cancellationToken);

    /// <summary>An administrator-started run from Match, optionally granting tenant consent first.</summary>
    Task RunAsync(
        Guid sessionId,
        RunImportSemanticAssistanceRequest request,
        ImportActor actor,
        CancellationToken cancellationToken);

    /// <summary>
    /// Counts administrator changes to mappings that semantic assistance supplied. The caller
    /// saves the change together with its own decision update.
    /// </summary>
    Task RecordOverridesAsync(Guid sessionId, int overriddenCount, CancellationToken cancellationToken);
}
