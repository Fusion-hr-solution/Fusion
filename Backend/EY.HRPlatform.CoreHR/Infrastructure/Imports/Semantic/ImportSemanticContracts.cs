using System.Text.Json.Serialization;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;

// The domain-neutral vocabulary of semantic assistance, shared by every import domain. What a
// question means, which targets it allows and how an answer is applied stay domain-owned.

/// <summary>
/// Semantic assistance as the product sees it. Deliberately independent of Match readiness:
/// a successful run can leave questions open, and a failed one never blocks manual Match.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportSemanticAssistanceState
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
public enum ImportSemanticConsentMode
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
public enum ImportSemanticConsentScope
{
    Tenant,
    Import,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportSemanticAttemptStatus
{
    Running,
    Succeeded,
    Failed,
    Stale,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportSemanticFailureCategory
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
public enum ImportSemanticTrigger
{
    Upload,
    Administrator,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportSemanticDisposition
{
    Suggest,
    Abstain,
}

public sealed record ImportSemanticTarget(string Key, string Label);

/// <summary>One unresolved semantic question and the exact targets Fusion allows as its answer.</summary>
public sealed record ImportSemanticIssue(
    string Key,
    string Kind,
    int? SourceColumnIndex,
    string? SourceLabel,
    IReadOnlyList<ImportSemanticTarget> AllowedTargets);

/// <summary>One answer per question: a target from the allowed list, or an explicit abstention.</summary>
public sealed record ImportSemanticAnswer(
    string QuestionKey,
    ImportSemanticDisposition Disposition,
    string? TargetKey);

public sealed record ImportSemanticProviderResult(
    IReadOnlyList<ImportSemanticAnswer> Answers,
    int? InputTokens,
    int? OutputTokens,
    string? ResponseId = null,
    string? SystemFingerprint = null);

public sealed class ImportSemanticProviderException(
    ImportSemanticFailureCategory category,
    string safeMessage,
    DateTime? retryAfter = null,
    Exception? innerException = null) : Exception(safeMessage, innerException)
{
    public ImportSemanticFailureCategory Category { get; } = category;
    public DateTime? RetryAfter { get; } = retryAfter;
    public bool Retryable => ImportSemanticFailures.IsTransient(Category);
}

public static class ImportSemanticFailures
{
    /// <summary>Failures worth another attempt: the provider may answer next time. Configuration and credential failures will not.</summary>
    public static bool IsTransient(ImportSemanticFailureCategory category)
        => category is ImportSemanticFailureCategory.Timeout
            or ImportSemanticFailureCategory.RateLimited
            or ImportSemanticFailureCategory.ProviderUnavailable
            or ImportSemanticFailureCategory.InvalidOutput
            or ImportSemanticFailureCategory.Interrupted;
}

/// <summary>
/// The product-level truth about semantic assistance for one import. The UI never has to infer
/// whether AI ran, and never sees provider internals.
/// </summary>
public sealed record ImportSemanticAssistanceDto(
    ImportSemanticAssistanceState State,
    string? InputFingerprint,
    int ExaminedCount,
    int AppliedCount,
    int AbstainedCount,
    int RemainingCount,
    DateTime? LastCompletedAt,
    bool CanRetry,
    DateTime? RetryAfter,
    ImportSemanticFailureCategory? FailureCategory,
    ImportSemanticConsentScope ConsentScope = ImportSemanticConsentScope.Tenant)
{
    public static ImportSemanticAssistanceDto Of(
        ImportSemanticAssistanceState state,
        string? inputFingerprint,
        int remaining)
        => new(state, inputFingerprint, 0, 0, 0, remaining, null, false, null, null);
}

/// <summary>Starts a run from Match: the first time (granting tenant consent) or after a retryable failure.</summary>
public sealed record RunImportSemanticAssistanceRequest(
    string InputFingerprint,
    bool GrantTenantConsent = false);

/// <summary>A validated suggestion that was written into the Mapping Plan, kept for provenance and override tracking.</summary>
public sealed record ImportAppliedSuggestion(
    string QuestionKey,
    string Kind,
    string TargetKey,
    string? SourceLabel);

/// <summary>What Fusion did with one provider answer set.</summary>
public sealed record ImportSemanticRunOutcome(
    int Returned,
    int Accepted,
    int Rejected,
    int Abstentions,
    IReadOnlyList<ImportAppliedSuggestion> Applied);

/// <summary>
/// A tenant administrator's standing permission to send the bounded semantic payload to one
/// provider under one data contract. It deliberately does not name a model: a model change
/// does not change what leaves Fusion or who processes it; a provider or data-contract change does.
/// </summary>
public sealed class ImportSemanticConsent : BaseEntity, ITenantEntity
{
    private ImportSemanticConsent() { }

    public Guid TenantId { get; private set; }
    /// <summary>Null for standing tenant consent; the import it covers in per-import mode.</summary>
    public Guid? SessionId { get; private set; }
    public string Provider { get; private set; } = string.Empty;
    public string DataContractVersion { get; private set; } = string.Empty;
    public Guid GrantedByUserId { get; private set; }
    public string GrantedByDisplayName { get; private set; } = string.Empty;
    public DateTime GrantedAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }

    public static ImportSemanticConsent Grant(
        Guid tenantId,
        string provider,
        string dataContractVersion,
        ImportActor actor,
        Guid? sessionId = null)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        var normalized = actor.Normalize();
        return new ImportSemanticConsent
        {
            TenantId = tenantId,
            SessionId = sessionId,
            Provider = provider,
            DataContractVersion = dataContractVersion,
            GrantedByUserId = normalized.UserId,
            GrantedByDisplayName = normalized.DisplayName,
            GrantedAt = DateTime.UtcNow,
        };
    }

    public void Revoke()
    {
        RevokedAt ??= DateTime.UtcNow;
        UpdatedAt = RevokedAt;
    }
}

