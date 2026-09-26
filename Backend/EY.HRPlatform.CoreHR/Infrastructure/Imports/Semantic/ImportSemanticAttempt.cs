using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;

/// <summary>
/// One semantic run: what was asked, of which provider/model/prompt, what came back, and what
/// Fusion did with it. Every contribution question in the semantic contract is answerable from
/// this row without reading logs. Raw prompts and provider responses are never stored.
/// Each import domain persists its runs in its own table through a sealed subclass.
/// </summary>
public abstract class ImportSemanticAttempt : BaseEntity, ITenantEntity
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public Guid TenantId { get; protected set; }
    public Guid SessionId { get; protected set; }
    public int Version { get; protected set; } = 1;
    public int AttemptOrdinal { get; protected set; }
    public ImportSemanticTrigger Trigger { get; protected set; }
    public string SourceFingerprint { get; protected set; } = string.Empty;
    public string InputFingerprint { get; protected set; } = string.Empty;
    public string DataContractVersion { get; protected set; } = string.Empty;
    public string ResultContractVersion { get; protected set; } = string.Empty;
    public string PromptVersion { get; protected set; } = string.Empty;
    public string Provider { get; protected set; } = string.Empty;
    public string Model { get; protected set; } = string.Empty;
    public ImportSemanticAttemptStatus Status { get; protected set; }
    /// <summary>The question keys this run was asked, so later questions can be recognised as new.</summary>
    public string EligibleIssueKeysJson { get; protected set; } = "[]";
    /// <summary>The validated suggestions this run wrote into the Mapping Plan.</summary>
    public string SuggestionsJson { get; protected set; } = "[]";
    public Guid? ReusedFromAttemptId { get; protected set; }
    public string? ProviderResponseId { get; protected set; }
    public string? ProviderSystemFingerprint { get; protected set; }
    public ImportSemanticFailureCategory? FailureCategory { get; protected set; }
    public string? DiagnosticCode { get; protected set; }
    public DateTime RequestedAt { get; protected set; }
    public DateTime? CompletedAt { get; protected set; }
    public DateTime? RetryAfter { get; protected set; }
    public int RetryCount { get; protected set; }
    public int? LatencyMilliseconds { get; protected set; }
    public int? InputTokens { get; protected set; }
    public int? OutputTokens { get; protected set; }
    public int QuestionsSubmitted { get; protected set; }
    public int SuggestionsReturned { get; protected set; }
    public int SuggestionsAccepted { get; protected set; }
    public int SuggestionsRejected { get; protected set; }
    public int SuggestionsApplied { get; protected set; }
    public int Abstentions { get; protected set; }
    public int SuggestionsOverridden { get; protected set; }

    protected void Initialize(
        Guid tenantId,
        Guid sessionId,
        int attemptOrdinal,
        ImportSemanticTrigger trigger,
        string sourceFingerprint,
        string inputFingerprint,
        string dataContractVersion,
        string resultContractVersion,
        string promptVersion,
        string provider,
        string model,
        IReadOnlyList<string> questionKeys)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (sessionId == Guid.Empty) throw new ArgumentException("Session is required.", nameof(sessionId));
        if (attemptOrdinal < 1) throw new ArgumentOutOfRangeException(nameof(attemptOrdinal));
        TenantId = tenantId;
        SessionId = sessionId;
        AttemptOrdinal = attemptOrdinal;
        Trigger = trigger;
        SourceFingerprint = sourceFingerprint;
        InputFingerprint = inputFingerprint;
        DataContractVersion = dataContractVersion;
        ResultContractVersion = resultContractVersion;
        PromptVersion = promptVersion;
        Provider = provider;
        Model = model;
        Status = ImportSemanticAttemptStatus.Running;
        EligibleIssueKeysJson = JsonSerializer.Serialize(questionKeys, Json);
        QuestionsSubmitted = questionKeys.Count;
        RequestedAt = DateTime.UtcNow;
    }

    public IReadOnlyList<string> QuestionKeys()
        => JsonSerializer.Deserialize<IReadOnlyList<string>>(EligibleIssueKeysJson, Json) ?? [];

    public IReadOnlyList<ImportAppliedSuggestion> AppliedSuggestions()
        => JsonSerializer.Deserialize<IReadOnlyList<ImportAppliedSuggestion>>(SuggestionsJson, Json) ?? [];

    public void Succeed(
        ImportSemanticRunOutcome outcome,
        ImportSemanticProviderResult? providerResult,
        int elapsedMilliseconds,
        int retryCount,
        Guid? reusedFromAttemptId = null)
    {
        EnsureRunning();
        Status = ImportSemanticAttemptStatus.Succeeded;
        SuggestionsReturned = outcome.Returned;
        SuggestionsAccepted = outcome.Accepted;
        SuggestionsRejected = outcome.Rejected;
        SuggestionsApplied = outcome.Applied.Count;
        Abstentions = outcome.Abstentions;
        SuggestionsJson = JsonSerializer.Serialize(outcome.Applied, Json);
        ProviderResponseId = Trim(providerResult?.ResponseId, 128);
        ProviderSystemFingerprint = Trim(providerResult?.SystemFingerprint, 128);
        InputTokens = providerResult?.InputTokens;
        OutputTokens = providerResult?.OutputTokens;
        ReusedFromAttemptId = reusedFromAttemptId;
        RetryCount = retryCount;
        LatencyMilliseconds = elapsedMilliseconds;
        FailureCategory = null;
        RetryAfter = null;
        CompletedAt = DateTime.UtcNow;
        Touch();
    }

    public void Fail(
        ImportSemanticFailureCategory category,
        int elapsedMilliseconds,
        int retryCount,
        DateTime? retryAfter = null,
        string? diagnosticCode = null)
    {
        EnsureRunning();
        Status = ImportSemanticAttemptStatus.Failed;
        FailureCategory = category;
        DiagnosticCode = Trim(diagnosticCode, 80);
        RetryAfter = retryAfter;
        RetryCount = retryCount;
        CompletedAt = DateTime.UtcNow;
        LatencyMilliseconds = elapsedMilliseconds;
        Touch();
    }

    /// <summary>The run's input no longer matches the import, so its answers are not applied.</summary>
    public void MarkStale()
    {
        if (Status == ImportSemanticAttemptStatus.Stale) return;
        if (Status == ImportSemanticAttemptStatus.Running) CompletedAt = DateTime.UtcNow;
        Status = ImportSemanticAttemptStatus.Stale;
        Touch();
    }

    public void RecordOverrides(int count)
    {
        if (count <= 0) return;
        SuggestionsOverridden += count;
        Touch();
    }

    /// <summary>A run still marked Running well past its budget was interrupted (the process stopped mid-call).</summary>
    public bool IsAbandoned(TimeSpan budget)
        => Status == ImportSemanticAttemptStatus.Running && RequestedAt.Add(budget).AddSeconds(5) < DateTime.UtcNow;

    private void EnsureRunning()
    {
        if (Status != ImportSemanticAttemptStatus.Running)
            throw new InvalidOperationException("Only a running assistance attempt can be completed.");
    }

    private void Touch()
    {
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? Trim(string? value, int length)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, length)];
}
