namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>
/// Workforce-specific semantic assistance boundary. Distinct from Organization Import: it maps
/// unresolved source COLUMN meaning to allowed Workforce fields only — it never decides identity,
/// invents numbers/managers/organizations/dates, or mutates canonical data. The provider payload
/// carries no person-level PII (see <see cref="WorkforceImportSemanticContextBuilder"/>).
/// </summary>
public sealed class WorkforceImportSemanticAssistanceOptions
{
    public const string SectionName = "WorkforceImport:SemanticAssistance";

    public bool Enabled { get; init; }
    public string Provider { get; init; } = "groq";
    public string Model { get; init; } = "llama-3.3-70b-versatile";
    public string? ApiKey { get; set; }
    public string BaseUrl { get; init; } = "https://api.groq.com/openai/v1/";
    public int TimeoutSeconds { get; init; } = 20;
}

public enum WorkforceSemanticValueKind { Text, Numeric, DateLike, EmailLike, IdentifierLike, Mixed, Empty }

public enum WorkforceSemanticFailureCategory { NotConfigured, RateLimited, ProviderUnavailable, InvalidOutput, Timeout }

/// <summary>An allowed Fusion target a suggestion may point a source column at (runtime-constrained enum).</summary>
public sealed record WorkforceSemanticTarget(string Key, string DisplayName);

/// <summary>
/// PII-minimized context for one unresolved source column. Deliberately excludes raw person values;
/// carries only label, local value-kind, counts, redacted pattern evidence, and — only when the
/// classifier positively identified the column as safe non-person business vocabulary — bounded samples.
/// </summary>
public sealed record WorkforceSemanticColumnContext(
    int ColumnIndex,
    string SourceLabel,
    WorkforceSemanticValueKind ValueKind,
    int NonEmptyCount,
    int DistinctCount,
    string PatternSummary,
    IReadOnlyList<string> SafeVocabularySamples);

public sealed record WorkforceImportSemanticRequest(
    string ContractVersion,
    IReadOnlyList<WorkforceSemanticColumnContext> Columns,
    IReadOnlyList<WorkforceSemanticTarget> AllowedTargets);

public sealed record WorkforceImportSemanticSuggestion(int ColumnIndex, string TargetKey, string? Rationale);

public sealed record WorkforceImportSemanticProviderResult(
    IReadOnlyList<WorkforceImportSemanticSuggestion> Suggestions,
    int? InputTokens,
    int? OutputTokens);

public sealed class WorkforceImportSemanticProviderException(
    WorkforceSemanticFailureCategory category,
    string safeMessage,
    DateTime? retryAfter = null,
    Exception? innerException = null) : Exception(safeMessage, innerException)
{
    public WorkforceSemanticFailureCategory Category { get; } = category;
    public DateTime? RetryAfter { get; } = retryAfter;
}

public interface IWorkforceImportSemanticProvider
{
    string ProviderName { get; }
    string ModelName { get; }
    bool IsConfigured { get; }
    Task<WorkforceImportSemanticProviderResult> SuggestAsync(WorkforceImportSemanticRequest request, CancellationToken cancellationToken);
}
