using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>
/// Workforce semantic assistance settings. Assistance interprets unresolved source semantics only
/// (which column means what, what a status value means); it never resolves people, managers or
/// organization units, never invents values, and never publishes.
/// </summary>
public sealed class WorkforceImportSemanticAssistanceOptions
{
    public const string SectionName = "WorkforceImport:SemanticAssistance";

    public bool Enabled { get; set; } = true;
    /// <summary>
    /// Workforce files carry employee data, so the product mode is tenant standing consent under the
    /// workforce data contract. Organization consent never covers Workforce.
    /// </summary>
    public ImportSemanticConsentMode ConsentMode { get; set; } = ImportSemanticConsentMode.Tenant;
    public string Provider { get; set; } = "Groq";
    /// <summary>The single pinned model. A change must pass the Workforce evaluation corpus first.</summary>
    public string Model { get; set; } = "openai/gpt-oss-120b";
    public string? ApiKey { get; set; }
    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/";
    public int TimeoutSeconds { get; set; } = 20;
    public int UploadBudgetSeconds { get; set; } = 20;
    public int InteractiveBudgetSeconds { get; set; } = 30;
    public int MaxRetries { get; set; } = 1;
    public int MaxQuestions { get; set; } = 32;
}

/// <summary>The versions that govern a Workforce semantic run. Each is recorded on every attempt.</summary>
public static class WorkforceImportSemanticVersions
{
    /// <summary>What leaves Fusion: column metadata, masked shapes, safe vocabulary and status values only. Consent binds to it.</summary>
    public const string DataContract = "workforce-import-semantic-data/1";
    public const string ResultContract = "workforce-import-semantics/v1";
    public const string Prompt = "workforce-import-semantic-prompt/1";
}

public static class WorkforceImportSemanticKinds
{
    public const string FieldMapping = "field_mapping";
    public const string LifecycleVocabulary = "lifecycle_vocabulary";
}

public enum WorkforceSemanticValueKind { Text, Numeric, DateLike, EmailLike, IdentifierLike, Mixed, Empty }

/// <summary>
/// PII-minimized evidence for one unresolved source column: label, local value kind, counts,
/// uniqueness, a masked pattern, and bounded samples only for safe non-person business vocabulary.
/// </summary>
public sealed record WorkforceSemanticColumnContext(
    int ColumnIndex,
    string SourceLabel,
    WorkforceSemanticValueKind ValueKind,
    int NonEmptyCount,
    int DistinctCount,
    decimal NonEmptyRate,
    decimal UniquenessRate,
    string PatternSummary,
    IReadOnlyList<string> SafeVocabularySamples);

/// <summary>The bounded semantic input for one run: every open question plus only the evidence they need.</summary>
public sealed record WorkforceImportSemanticRequest(
    string ResultContractVersion,
    string SourceFingerprint,
    IReadOnlyList<ImportSemanticIssue> Questions,
    IReadOnlyList<WorkforceSemanticColumnContext> Columns,
    string InputFingerprint);

public interface IWorkforceImportSemanticProvider
{
    string ProviderName { get; }
    string ModelName { get; }
    bool IsConfigured { get; }

    /// <summary>Exactly one provider call. Retries belong to the shared runner, which owns the budget.</summary>
    Task<ImportSemanticProviderResult> SuggestAsync(WorkforceImportSemanticRequest request, CancellationToken cancellationToken);
}
