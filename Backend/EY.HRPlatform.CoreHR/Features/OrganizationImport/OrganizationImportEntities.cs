using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public enum OrganizationImportStatus
{
    Active,
    Discarded,
    Committed,
}

public sealed class OrganizationImportSession : BaseEntity, ITenantEntity
{
    private OrganizationImportSession() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public OrganizationImportStatus Status { get; private set; }
    public DateOnly EffectiveDate { get; private set; }
    public Guid CreationToken { get; private set; }
    public string CreationFingerprint { get; private set; } = string.Empty;
    public Guid StartedByUserId { get; private set; }
    public string StartedByDisplayName { get; private set; } = string.Empty;
    public Guid LastUpdatedByUserId { get; private set; }
    public string LastUpdatedByDisplayName { get; private set; } = string.Empty;
    public DateTime? DiscardedAt { get; private set; }
    public Guid? DiscardedByUserId { get; private set; }
    public string DecisionsJson { get; private set; } = "{}";
    public int DecisionRevision { get; private set; }
    public DateTime? DecisionsUpdatedAt { get; private set; }
    public Guid? DecisionsUpdatedByUserId { get; private set; }
    public string? DecisionsUpdatedByDisplayName { get; private set; }
    public DateTime? CommittedAt { get; private set; }
    public Guid? CommittedByUserId { get; private set; }
    public string? CommittedByDisplayName { get; private set; }
    public string? FinalSemanticDigest { get; private set; }
    public string? CommitResultJson { get; private set; }
    public string? FinalProvenanceJson { get; private set; }
    public string? MappingConfirmationJson { get; private set; }
    public string? AppliedMappingPlanJson { get; private set; }
    public OrganizationImportSource Source { get; private set; } = null!;

    public static OrganizationImportSession Create(
        Guid tenantId,
        DateOnly effectiveDate,
        Guid creationToken,
        string creationFingerprint,
        OrganizationImportActor actor)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (creationToken == Guid.Empty) throw new ArgumentException("Creation token is required.", nameof(creationToken));
        if (string.IsNullOrWhiteSpace(creationFingerprint)) throw new ArgumentException("Creation fingerprint is required.", nameof(creationFingerprint));

        return new OrganizationImportSession
        {
            TenantId = tenantId,
            EffectiveDate = effectiveDate,
            CreationToken = creationToken,
            CreationFingerprint = creationFingerprint,
            Status = OrganizationImportStatus.Active,
            StartedByUserId = actor.UserId,
            StartedByDisplayName = actor.DisplayName,
            LastUpdatedByUserId = actor.UserId,
            LastUpdatedByDisplayName = actor.DisplayName,
        };
    }

    public void AttachSource(OrganizationImportSource source) => Source = source;

    public void ChangeEffectiveDate(DateOnly date, OrganizationImportActor actor)
    {
        EnsureActive();
        if (date != EffectiveDate)
        {
            var decisions = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(DecisionsJson);
            if (decisions is not null) DecisionsJson = OrganizationImportJson.Serialize(decisions.WithoutExistingUnitChoices());
        }
        EffectiveDate = date;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceDecisions(OrganizationImportDecisions decisions, OrganizationImportActor actor)
    {
        EnsureActive();
        var normalized = decisions.Normalize();
        var previous = OrganizationImportJson.Deserialize<OrganizationImportDecisions>(DecisionsJson)?.Normalize();
        if (previous is null || !SameMappingPlan(previous, normalized))
        {
            MappingConfirmationJson = null;
            AppliedMappingPlanJson = null;
            // Review resolutions were made against the previous canonical proposal.
            if (previous is not null) normalized = normalized.WithoutReviewResolutions();
        }
        DecisionsJson = OrganizationImportJson.Serialize(normalized);
        DecisionRevision++;
        DecisionsUpdatedAt = DateTime.UtcNow;
        DecisionsUpdatedByUserId = actor.UserId;
        DecisionsUpdatedByDisplayName = actor.DisplayName;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DecisionsUpdatedAt;
    }

    public void ConfirmMapping(string digest, OrganizationImportActor actor)
    {
        EnsureActive();
        MappingConfirmationJson = OrganizationImportJson.Serialize(new OrganizationImportMappingConfirmation(
            digest, actor.Normalize().UserId, actor.Normalize().DisplayName, DateTime.UtcNow));
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool HasConfirmedMapping(string digest)
        => OrganizationImportJson.Deserialize<OrganizationImportMappingConfirmation>(MappingConfirmationJson)?.Digest == digest;

    public void ApplyMappingPlan(OrganizationImportMappingPlan plan)
    {
        EnsureActive();
        if (plan.SourceFingerprint != SourceFingerprint())
            throw new InvalidOperationException("A mapping plan cannot be applied to a different source.");
        AppliedMappingPlanJson = OrganizationImportJson.Serialize(plan);
    }

    private static bool SameMappingPlan(OrganizationImportDecisions left, OrganizationImportDecisions right)
        => left.Shape == right.Shape
            && left.IdentityStrategy == right.IdentityStrategy
            && left.FieldMappings!.OrderBy(item => item.Key, StringComparer.Ordinal)
                .SequenceEqual(right.FieldMappings!.OrderBy(item => item.Key, StringComparer.Ordinal))
            && left.TypeMappings!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .SequenceEqual(right.TypeMappings!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
            && left.ShapeDecisionOrigin == right.ShapeDecisionOrigin
            && left.FieldMappingOrigins!.OrderBy(item => item.Key, StringComparer.Ordinal)
                .SequenceEqual(right.FieldMappingOrigins!.OrderBy(item => item.Key, StringComparer.Ordinal))
            && left.TypeMappingOrigins!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .SequenceEqual(right.TypeMappingOrigins!.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase));

    private string SourceFingerprint()
        => Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            $"{Source.Sha256}\n{Source.SelectedSheetName}\n{Source.SelectedRange}")));

    public void Commit(
        string semanticDigest,
        OrganizationImportCommitResult result,
        IReadOnlyList<OrganizationImportProvenance> provenance,
        OrganizationImportActor actor)
    {
        EnsureActive();
        Status = OrganizationImportStatus.Committed;
        CommittedAt = DateTime.UtcNow;
        CommittedByUserId = actor.UserId;
        CommittedByDisplayName = actor.DisplayName;
        FinalSemanticDigest = semanticDigest;
        CommitResultJson = OrganizationImportJson.Serialize(result);
        FinalProvenanceJson = OrganizationImportJson.Serialize(provenance);
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = CommittedAt;
        Source.PurgePayload();
    }

    public bool Discard(OrganizationImportActor actor)
    {
        if (Status == OrganizationImportStatus.Discarded) return false;
        Status = OrganizationImportStatus.Discarded;
        DiscardedAt = DateTime.UtcNow;
        DiscardedByUserId = actor.UserId;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DiscardedAt;
        Source.PurgePayload();
        return true;
    }

    private void EnsureActive()
    {
        if (Status != OrganizationImportStatus.Active)
            throw new InvalidOperationException("A terminal import cannot be changed.");
    }
}

public sealed class OrganizationImportSource : BaseEntity, ITenantEntity
{
    private OrganizationImportSource() { }

    public Guid SessionId { get; private set; }
    public Guid TenantId { get; private set; }
    public string OriginalFileName { get; private set; } = string.Empty;
    public string SourceFormat { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long ByteLength { get; private set; }
    public string Sha256 { get; private set; } = string.Empty;
    public string SelectedSheetName { get; private set; } = string.Empty;
    public string SelectedRange { get; private set; } = string.Empty;
    public int ColumnCount { get; private set; }
    public int RowCount { get; private set; }
    public string? SourceTableJson { get; private set; }
    public byte[]? RawBytes { get; private set; }
    public DateTime? PayloadPurgedAt { get; private set; }
    public OrganizationImportSession Session { get; private set; } = null!;

    public static OrganizationImportSource Create(
        Guid tenantId,
        Guid sessionId,
        InspectedOrganizationSource source)
        => new()
        {
            TenantId = tenantId,
            SessionId = sessionId,
            OriginalFileName = source.OriginalFileName,
            SourceFormat = source.SourceFormat,
            ContentType = source.ContentType,
            ByteLength = source.RawBytes.LongLength,
            Sha256 = source.Sha256,
            SelectedSheetName = source.SelectedSheetName,
            SelectedRange = source.SelectedRange,
            ColumnCount = source.Table.Columns.Count,
            RowCount = source.Table.Rows.Count,
            SourceTableJson = OrganizationImportJson.Serialize(source.Table),
            RawBytes = source.RawBytes,
        };

    public void PurgePayload()
    {
        if (PayloadPurgedAt is not null) return;
        RawBytes = null;
        SourceTableJson = null;
        PayloadPurgedAt = DateTime.UtcNow;
        UpdatedAt = PayloadPurgedAt;
    }
}

/// <summary>
/// One semantic run: what was asked, of which provider/model/prompt, what came back, and what
/// Fusion did with it. Every contribution question in the semantic contract is answerable from
/// this row without reading logs. Raw prompts and provider responses are never stored.
/// </summary>
public sealed class OrganizationImportSemanticAttempt : BaseEntity, ITenantEntity
{
    private OrganizationImportSemanticAttempt() { }

    public Guid TenantId { get; private set; }
    public Guid SessionId { get; private set; }
    public int Version { get; private set; } = 1;
    public int AttemptOrdinal { get; private set; }
    public OrganizationImportSemanticTrigger Trigger { get; private set; }
    public string SourceFingerprint { get; private set; } = string.Empty;
    public string InputFingerprint { get; private set; } = string.Empty;
    public string DataContractVersion { get; private set; } = string.Empty;
    public string ResultContractVersion { get; private set; } = string.Empty;
    public string PromptVersion { get; private set; } = string.Empty;
    public string Provider { get; private set; } = string.Empty;
    public string Model { get; private set; } = string.Empty;
    public OrganizationImportSemanticAttemptStatus Status { get; private set; }
    /// <summary>The question keys this run was asked, so later questions can be recognised as new.</summary>
    public string EligibleIssueKeysJson { get; private set; } = "[]";
    /// <summary>The validated suggestions this run wrote into the Mapping Plan.</summary>
    public string SuggestionsJson { get; private set; } = "[]";
    public Guid? ReusedFromAttemptId { get; private set; }
    public string? ProviderResponseId { get; private set; }
    public string? ProviderSystemFingerprint { get; private set; }
    public OrganizationImportSemanticFailureCategory? FailureCategory { get; private set; }
    public string? DiagnosticCode { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public DateTime? RetryAfter { get; private set; }
    public int RetryCount { get; private set; }
    public int? LatencyMilliseconds { get; private set; }
    public int? InputTokens { get; private set; }
    public int? OutputTokens { get; private set; }
    public int QuestionsSubmitted { get; private set; }
    public int SuggestionsReturned { get; private set; }
    public int SuggestionsAccepted { get; private set; }
    public int SuggestionsRejected { get; private set; }
    public int SuggestionsApplied { get; private set; }
    public int Abstentions { get; private set; }
    public int SuggestionsOverridden { get; private set; }

    public static OrganizationImportSemanticAttempt Start(
        Guid tenantId,
        Guid sessionId,
        int attemptOrdinal,
        OrganizationImportSemanticTrigger trigger,
        OrganizationImportSemanticRequest request,
        string provider,
        string model)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (sessionId == Guid.Empty) throw new ArgumentException("Session is required.", nameof(sessionId));
        if (attemptOrdinal < 1) throw new ArgumentOutOfRangeException(nameof(attemptOrdinal));
        return new OrganizationImportSemanticAttempt
        {
            TenantId = tenantId,
            SessionId = sessionId,
            AttemptOrdinal = attemptOrdinal,
            Trigger = trigger,
            SourceFingerprint = request.SourceFingerprint,
            InputFingerprint = request.InputFingerprint,
            DataContractVersion = OrganizationImportSemanticVersions.DataContract,
            ResultContractVersion = request.ResultContractVersion,
            PromptVersion = OrganizationImportSemanticVersions.Prompt,
            Provider = provider,
            Model = model,
            Status = OrganizationImportSemanticAttemptStatus.Running,
            EligibleIssueKeysJson = OrganizationImportJson.Serialize(request.Issues.Select(issue => issue.Key).ToList()),
            QuestionsSubmitted = request.Issues.Count,
            RequestedAt = DateTime.UtcNow,
        };
    }

    public IReadOnlyList<string> QuestionKeys()
        => OrganizationImportJson.Deserialize<IReadOnlyList<string>>(EligibleIssueKeysJson) ?? [];

    public IReadOnlyList<OrganizationImportAppliedSuggestion> AppliedSuggestions()
        => OrganizationImportJson.Deserialize<IReadOnlyList<OrganizationImportAppliedSuggestion>>(SuggestionsJson) ?? [];

    public void Succeed(
        OrganizationImportSemanticRunOutcome outcome,
        OrganizationImportSemanticProviderResult? providerResult,
        int elapsedMilliseconds,
        int retryCount,
        Guid? reusedFromAttemptId = null)
    {
        EnsureRunning();
        Status = OrganizationImportSemanticAttemptStatus.Succeeded;
        SuggestionsReturned = outcome.Returned;
        SuggestionsAccepted = outcome.Accepted;
        SuggestionsRejected = outcome.Rejected;
        SuggestionsApplied = outcome.Applied.Count;
        Abstentions = outcome.Abstentions;
        SuggestionsJson = OrganizationImportJson.Serialize(outcome.Applied);
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
        OrganizationImportSemanticFailureCategory category,
        int elapsedMilliseconds,
        int retryCount,
        DateTime? retryAfter = null,
        string? diagnosticCode = null)
    {
        EnsureRunning();
        Status = OrganizationImportSemanticAttemptStatus.Failed;
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
        if (Status == OrganizationImportSemanticAttemptStatus.Stale) return;
        if (Status == OrganizationImportSemanticAttemptStatus.Running) CompletedAt = DateTime.UtcNow;
        Status = OrganizationImportSemanticAttemptStatus.Stale;
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
        => Status == OrganizationImportSemanticAttemptStatus.Running && RequestedAt.Add(budget).AddSeconds(5) < DateTime.UtcNow;

    private void EnsureRunning()
    {
        if (Status != OrganizationImportSemanticAttemptStatus.Running)
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

/// <summary>What Fusion did with one provider answer set.</summary>
public sealed record OrganizationImportSemanticRunOutcome(
    int Returned,
    int Accepted,
    int Rejected,
    int Abstentions,
    IReadOnlyList<OrganizationImportAppliedSuggestion> Applied);

/// <summary>
/// A tenant administrator's standing permission to send the bounded semantic payload to one
/// provider under one data contract. It deliberately does not name a model: a model change
/// does not change what leaves Fusion or who processes it; a provider or data-contract change does.
/// </summary>
public sealed class OrganizationImportSemanticConsent : BaseEntity, ITenantEntity
{
    private OrganizationImportSemanticConsent() { }

    public Guid TenantId { get; private set; }
    /// <summary>Null for standing tenant consent; the import it covers in per-import mode.</summary>
    public Guid? SessionId { get; private set; }
    public string Provider { get; private set; } = string.Empty;
    public string DataContractVersion { get; private set; } = string.Empty;
    public Guid GrantedByUserId { get; private set; }
    public string GrantedByDisplayName { get; private set; } = string.Empty;
    public DateTime GrantedAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }

    public static OrganizationImportSemanticConsent Grant(
        Guid tenantId,
        string provider,
        string dataContractVersion,
        OrganizationImportActor actor,
        Guid? sessionId = null)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        var normalized = actor.Normalize();
        return new OrganizationImportSemanticConsent
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

public sealed record OrganizationImportActor(Guid UserId, string DisplayName)
{
    public OrganizationImportActor Normalize()
        => new(UserId, string.IsNullOrWhiteSpace(DisplayName) ? "Unknown" : DisplayName.Trim()[..Math.Min(DisplayName.Trim().Length, 256)]);
}

public sealed record OrganizationImportMappingConfirmation(string Digest, Guid ConfirmedByUserId, string ConfirmedByDisplayName, DateTime ConfirmedAt);
