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
        EffectiveDate = date;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceDecisions(OrganizationImportDecisions decisions, OrganizationImportActor actor)
    {
        EnsureActive();
        DecisionsJson = OrganizationImportJson.Serialize(decisions.Normalize());
        DecisionRevision++;
        DecisionsUpdatedAt = DateTime.UtcNow;
        DecisionsUpdatedByUserId = actor.UserId;
        DecisionsUpdatedByDisplayName = actor.DisplayName;
        LastUpdatedByUserId = actor.UserId;
        LastUpdatedByDisplayName = actor.DisplayName;
        UpdatedAt = DecisionsUpdatedAt;
    }

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

public sealed class OrganizationImportSemanticAttempt : BaseEntity, ITenantEntity
{
    private OrganizationImportSemanticAttempt() { }

    public Guid TenantId { get; private set; }
    public Guid SessionId { get; private set; }
    public int Version { get; private set; } = 1;
    public int AttemptOrdinal { get; private set; }
    public string ContractVersion { get; private set; } = string.Empty;
    public string InputFingerprint { get; private set; } = string.Empty;
    public OrganizationImportSemanticAttemptStatus Status { get; private set; }
    public string Provider { get; private set; } = string.Empty;
    public string Model { get; private set; } = string.Empty;
    public string EligibleIssueKeysJson { get; private set; } = "[]";
    public string SuggestionsJson { get; private set; } = "[]";
    public string? ReviewOutcomesJson { get; private set; }
    public OrganizationImportSemanticFailureCategory? FailureCategory { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public DateTime? RetryAfter { get; private set; }
    public int? LatencyMilliseconds { get; private set; }
    public int? InputTokens { get; private set; }
    public int? OutputTokens { get; private set; }
    public Guid? AppliedByUserId { get; private set; }
    public string? AppliedByDisplayName { get; private set; }
    public DateTime? AppliedAt { get; private set; }

    public static OrganizationImportSemanticAttempt CreatePending(
        Guid tenantId,
        Guid sessionId,
        int attemptOrdinal,
        string contractVersion,
        string inputFingerprint,
        string provider,
        string model,
        IReadOnlyList<string> eligibleIssueKeys)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (sessionId == Guid.Empty) throw new ArgumentException("Session is required.", nameof(sessionId));
        if (attemptOrdinal < 1) throw new ArgumentOutOfRangeException(nameof(attemptOrdinal));
        return new OrganizationImportSemanticAttempt
        {
            TenantId = tenantId,
            SessionId = sessionId,
            AttemptOrdinal = attemptOrdinal,
            ContractVersion = contractVersion,
            InputFingerprint = inputFingerprint,
            Status = OrganizationImportSemanticAttemptStatus.Pending,
            Provider = provider,
            Model = model,
            EligibleIssueKeysJson = OrganizationImportJson.Serialize(eligibleIssueKeys),
            RequestedAt = DateTime.UtcNow,
        };
    }

    public void Complete(
        IReadOnlyList<OrganizationImportSemanticProviderSuggestion> suggestions,
        int elapsedMilliseconds,
        int? inputTokens,
        int? outputTokens)
    {
        EnsurePending();
        Status = OrganizationImportSemanticAttemptStatus.Available;
        SuggestionsJson = OrganizationImportJson.Serialize(suggestions);
        FailureCategory = null;
        RetryAfter = null;
        CompletedAt = DateTime.UtcNow;
        LatencyMilliseconds = elapsedMilliseconds;
        InputTokens = inputTokens;
        OutputTokens = outputTokens;
        Touch();
    }

    public void Fail(
        OrganizationImportSemanticFailureCategory category,
        int elapsedMilliseconds,
        DateTime? retryAfter = null)
    {
        EnsurePending();
        Status = OrganizationImportSemanticAttemptStatus.Failed;
        FailureCategory = category;
        RetryAfter = retryAfter;
        CompletedAt = DateTime.UtcNow;
        LatencyMilliseconds = elapsedMilliseconds;
        SuggestionsJson = "[]";
        Touch();
    }

    public void Supersede()
    {
        if (Status == OrganizationImportSemanticAttemptStatus.Superseded) return;
        Status = OrganizationImportSemanticAttemptStatus.Superseded;
        Touch();
    }

    public void Apply(IReadOnlyList<OrganizationImportSemanticReviewRecord> outcomes, OrganizationImportActor actor)
    {
        if (Status != OrganizationImportSemanticAttemptStatus.Available)
            throw new InvalidOperationException("Only available suggestions can be applied.");
        var normalizedActor = actor.Normalize();
        Status = OrganizationImportSemanticAttemptStatus.Applied;
        ReviewOutcomesJson = OrganizationImportJson.Serialize(outcomes);
        AppliedByUserId = normalizedActor.UserId;
        AppliedByDisplayName = normalizedActor.DisplayName;
        AppliedAt = DateTime.UtcNow;
        Touch();
    }

    private void EnsurePending()
    {
        if (Status != OrganizationImportSemanticAttemptStatus.Pending)
            throw new InvalidOperationException("Only a pending assistance attempt can be completed.");
    }

    private void Touch()
    {
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed record OrganizationImportActor(Guid UserId, string DisplayName)
{
    public OrganizationImportActor Normalize()
        => new(UserId, string.IsNullOrWhiteSpace(DisplayName) ? "Unknown" : DisplayName.Trim()[..Math.Min(DisplayName.Trim().Length, 256)]);
}
