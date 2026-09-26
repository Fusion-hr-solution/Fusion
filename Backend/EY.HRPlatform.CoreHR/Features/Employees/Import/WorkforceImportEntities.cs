using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import;

// Workforce Import — create-only establishment of the tenant's workforce. An import attempt follows
// the same CoreHR import lifecycle as Organization Import: Active until an administrator publishes
// it (Committed) or discards it (Discarded). The source and row payload are purged on every
// terminal outcome; the attempt itself stays as durable provenance with its commit result.

public enum WorkforceImportStatus
{
    Active,
    Discarded,
    Committed,
}

/// <summary>What publication will do with a source row. Derived, never chosen.</summary>
public enum WorkforceImportRowClassification
{
    /// <summary>Row has not been interpreted/resolved yet.</summary>
    Unresolved,
    /// <summary>Fusion will create this employee.</summary>
    Create,
    /// <summary>The employee already exists; Fusion makes no change and may use them as a reference.</summary>
    Existing,
    /// <summary>The row describes someone outside establishment scope (former worker, future start).</summary>
    NotImported,
    /// <summary>A blocker prevents publication until it is resolved.</summary>
    Blocked,
}

/// <summary>
/// One Workforce Import attempt. Match decisions live in <see cref="MappingPlanJson"/>; bounded
/// Review resolutions live in <see cref="ResolutionsJson"/>. While publication is queued or running
/// the attempt is frozen; it never changes source once created (a corrected file is a new attempt).
/// </summary>
public sealed class WorkforceImportSession : BaseEntity, ITenantEntity
{
    private WorkforceImportSession() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public WorkforceImportStatus Status { get; private set; }
    public DateOnly BaselineDate { get; private set; }
    public Guid CreationToken { get; private set; }
    public string CreationFingerprint { get; private set; } = string.Empty;
    public string SelectedSheetName { get; private set; } = string.Empty;

    public Guid StartedByUserId { get; private set; }
    public string StartedByDisplayName { get; private set; } = string.Empty;
    public Guid LastUpdatedByUserId { get; private set; }
    public string LastUpdatedByDisplayName { get; private set; } = string.Empty;

    /// <summary>Match: what the source means (column meanings, formats, identity strategy, vocabulary).</summary>
    public string MappingPlanJson { get; private set; } = "{}";
    /// <summary>Review: bounded resolutions that answer specific issues (never source-fact overrides).</summary>
    public string ResolutionsJson { get; private set; } = "{}";
    public int DecisionRevision { get; private set; }
    public DateTime? DecisionsUpdatedAt { get; private set; }
    public Guid? DecisionsUpdatedByUserId { get; private set; }
    public string? DecisionsUpdatedByDisplayName { get; private set; }

    public int CreateCount { get; private set; }
    public int ExistingCount { get; private set; }
    public int BlockedCount { get; private set; }
    public int NotImportedCount { get; private set; }
    public int WarningCount { get; private set; }
    public bool MatchComplete { get; private set; }

    /// <summary>Deterministic identity of the current proposal; publication must present exactly this.</summary>
    public string? ProposalFingerprint { get; private set; }

    /// <summary>Set while a publication operation is queued or running; every change is refused meanwhile.</summary>
    public DateTime? PublishingStartedAt { get; private set; }
    public DateTime? PayloadPurgedAt { get; private set; }

    public DateTime? DiscardedAt { get; private set; }
    public Guid? DiscardedByUserId { get; private set; }
    public DateTime? CommittedAt { get; private set; }
    public Guid? CommittedByUserId { get; private set; }
    public string? CommittedByDisplayName { get; private set; }
    public string? FinalProposalFingerprint { get; private set; }
    public string? CommitResultJson { get; private set; }
    public string? FinalProvenanceJson { get; private set; }

    public WorkforceImportSource Source { get; private set; } = null!;
    private readonly List<WorkforceImportRow> _rows = [];
    public IReadOnlyCollection<WorkforceImportRow> Rows => _rows;

    public static WorkforceImportSession Create(
        Guid tenantId,
        DateOnly baselineDate,
        Guid creationToken,
        string creationFingerprint,
        string selectedSheetName,
        ImportActor actor,
        DateTime nowUtc)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (creationToken == Guid.Empty) throw new ArgumentException("Creation token is required.", nameof(creationToken));
        if (string.IsNullOrWhiteSpace(creationFingerprint)) throw new ArgumentException("Creation fingerprint is required.", nameof(creationFingerprint));
        if (baselineDate > DateOnly.FromDateTime(nowUtc))
            throw new ArgumentException("Workforce Import establishes people already employed as of the selected date; use Hire for future employees.", nameof(baselineDate));

        var normalized = actor.Normalize();
        return new WorkforceImportSession
        {
            TenantId = tenantId,
            BaselineDate = baselineDate,
            CreationToken = creationToken,
            CreationFingerprint = creationFingerprint,
            SelectedSheetName = selectedSheetName,
            Status = WorkforceImportStatus.Active,
            StartedByUserId = normalized.UserId,
            StartedByDisplayName = normalized.DisplayName,
            LastUpdatedByUserId = normalized.UserId,
            LastUpdatedByDisplayName = normalized.DisplayName,
        };
    }

    public void AttachSource(WorkforceImportSource source) => Source = source;

    public void ReplaceRows(IEnumerable<WorkforceImportRow> rows)
    {
        EnsureMutable();
        _rows.Clear();
        _rows.AddRange(rows);
    }

    public void ChangeBaselineDate(DateOnly date, ImportActor actor, DateTime nowUtc)
    {
        EnsureMutable();
        if (date > DateOnly.FromDateTime(nowUtc))
            throw new InvalidOperationException("A future Workforce-as-of date is not allowed; use Hire for future employees.");
        BaselineDate = date;
        Touch(actor);
    }

    /// <summary>Records the derived proposal: counts, Match completeness and the proposal fingerprint.</summary>
    public void RecordProposal(
        int createCount,
        int existingCount,
        int blockedCount,
        int notImportedCount,
        int warningCount,
        bool matchComplete,
        string proposalFingerprint)
    {
        EnsureMutable();
        CreateCount = createCount;
        ExistingCount = existingCount;
        BlockedCount = blockedCount;
        NotImportedCount = notImportedCount;
        WarningCount = warningCount;
        MatchComplete = matchComplete;
        ProposalFingerprint = proposalFingerprint;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceMappingPlan(string mappingPlanJson, ImportActor actor)
    {
        EnsureMutable();
        MappingPlanJson = WorkforceImportJson.NormalizeDocument(mappingPlanJson);
        RecordDecisionChange(actor);
    }

    public void ReplaceResolutions(string resolutionsJson, ImportActor actor)
    {
        EnsureMutable();
        ResolutionsJson = WorkforceImportJson.NormalizeDocument(resolutionsJson);
        RecordDecisionChange(actor);
    }

    /// <summary>A proposal is publishable when Match is complete, nothing blocks, and at least one employee is created.</summary>
    public bool CanPublish => Status == WorkforceImportStatus.Active && MatchComplete && BlockedCount == 0 && CreateCount > 0;

    public bool IsPublishing => PublishingStartedAt is not null;

    /// <summary>Freezes the attempt for publication of the exact reviewed proposal.</summary>
    public void BeginPublish(ImportActor actor)
    {
        if (Status != WorkforceImportStatus.Active)
            throw new InvalidOperationException("Only an active import can be published.");
        if (IsPublishing)
            throw new InvalidOperationException("This import is already being published.");
        PublishingStartedAt = DateTime.UtcNow;
        Touch(actor);
    }

    /// <summary>A pre-canonical failure ends publication; the attempt returns to Review unchanged.</summary>
    public void EndPublish(ImportActor actor)
    {
        if (!IsPublishing) return;
        PublishingStartedAt = null;
        Touch(actor);
    }

    public void Commit(
        string proposalFingerprint,
        string commitResultJson,
        string finalProvenanceJson,
        ImportActor actor)
    {
        if (Status != WorkforceImportStatus.Active || !IsPublishing)
            throw new InvalidOperationException("Only an import being published can be committed.");
        var normalized = actor.Normalize();
        Status = WorkforceImportStatus.Committed;
        PublishingStartedAt = null;
        CommittedAt = DateTime.UtcNow;
        CommittedByUserId = normalized.UserId;
        CommittedByDisplayName = normalized.DisplayName;
        FinalProposalFingerprint = proposalFingerprint;
        CommitResultJson = commitResultJson;
        FinalProvenanceJson = finalProvenanceJson;
        Touch(actor);
        PurgePayload();
    }

    public bool Discard(ImportActor actor)
    {
        if (Status is WorkforceImportStatus.Discarded or WorkforceImportStatus.Committed) return false;
        if (IsPublishing)
            throw new InvalidOperationException("An import cannot be discarded while it is being published.");
        Status = WorkforceImportStatus.Discarded;
        DiscardedAt = DateTime.UtcNow;
        DiscardedByUserId = actor.Normalize().UserId;
        Touch(actor);
        PurgePayload();
        return true;
    }

    public bool IsActive => Status == WorkforceImportStatus.Active;

    public bool IsTerminal => Status is WorkforceImportStatus.Committed or WorkforceImportStatus.Discarded;

    private void RecordDecisionChange(ImportActor actor)
    {
        DecisionRevision++;
        var normalized = actor.Normalize();
        DecisionsUpdatedAt = DateTime.UtcNow;
        DecisionsUpdatedByUserId = normalized.UserId;
        DecisionsUpdatedByDisplayName = normalized.DisplayName;
        Touch(actor);
    }

    private void PurgePayload()
    {
        Source?.PurgePayload();
        foreach (var row in _rows) row.PurgePayload();
        if (PayloadPurgedAt is null) PayloadPurgedAt = DateTime.UtcNow;
    }

    private void EnsureMutable()
    {
        if (IsPublishing)
            throw new InvalidOperationException("The import is being published and cannot be changed.");
        if (IsTerminal)
            throw new InvalidOperationException("A finished import cannot be changed.");
    }

    private void Touch(ImportActor actor)
    {
        var normalized = actor.Normalize();
        LastUpdatedByUserId = normalized.UserId;
        LastUpdatedByDisplayName = normalized.DisplayName;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>Temporary raw source bytes + inspection metadata; purged on every terminal outcome.</summary>
public sealed class WorkforceImportSource : BaseEntity, ITenantEntity
{
    private WorkforceImportSource() { }

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
    public string? ColumnsJson { get; private set; }
    public byte[]? RawBytes { get; private set; }
    public DateTime? PayloadPurgedAt { get; private set; }
    public WorkforceImportSession Session { get; private set; } = null!;

    public static WorkforceImportSource Create(
        Guid tenantId,
        Guid sessionId,
        string originalFileName,
        string sourceFormat,
        string contentType,
        string sha256,
        string selectedSheetName,
        string selectedRange,
        int columnCount,
        int rowCount,
        string columnsJson,
        byte[] rawBytes)
        => new()
        {
            TenantId = tenantId,
            SessionId = sessionId,
            OriginalFileName = originalFileName,
            SourceFormat = sourceFormat,
            ContentType = contentType,
            ByteLength = rawBytes.LongLength,
            Sha256 = sha256,
            SelectedSheetName = selectedSheetName,
            SelectedRange = selectedRange,
            ColumnCount = columnCount,
            RowCount = rowCount,
            ColumnsJson = columnsJson,
            RawBytes = rawBytes,
        };

    /// <summary>Re-point the interpretation metadata (columns/range/counts) at the same retained bytes.</summary>
    public void UpdateInterpretation(string selectedSheetName, string selectedRange, int columnCount, int rowCount, string columnsJson)
    {
        SelectedSheetName = selectedSheetName;
        SelectedRange = selectedRange;
        ColumnCount = columnCount;
        RowCount = rowCount;
        ColumnsJson = columnsJson;
        UpdatedAt = DateTime.UtcNow;
    }

    public void PurgePayload()
    {
        if (PayloadPurgedAt is not null) return;
        RawBytes = null;
        ColumnsJson = null;
        PayloadPurgedAt = DateTime.UtcNow;
        UpdatedAt = PayloadPurgedAt;
    }
}

/// <summary>
/// One temporary record per source data row, so review can page/filter/search and grouped
/// resolution can update many rows without rebuilding a monolithic JSON blob. Source and
/// normalized PII are purged on every terminal outcome.
/// </summary>
public sealed class WorkforceImportRow : BaseEntity, ITenantEntity
{
    private WorkforceImportRow() { }

    public Guid SessionId { get; private set; }
    public Guid TenantId { get; private set; }
    public int SourceRowNumber { get; private set; }
    public string? SourceCellsJson { get; private set; }
    public string? NormalizedProposalJson { get; private set; }
    /// <summary>Lower-cased name, number, email, title and organization, for bounded server-side search.</summary>
    public string? SearchText { get; private set; }
    public Guid? CandidateEmployeeId { get; private set; }
    public Guid? ResolvedOrgUnitId { get; private set; }
    public string? ResolvedManagerKey { get; private set; }
    public WorkforceImportRowClassification Classification { get; private set; }
    public bool HasWarning { get; private set; }
    public string? IssueStateJson { get; private set; }
    public DateTime? PayloadPurgedAt { get; private set; }

    public static WorkforceImportRow Create(
        Guid tenantId,
        Guid sessionId,
        int sourceRowNumber,
        string sourceCellsJson)
        => new()
        {
            TenantId = tenantId,
            SessionId = sessionId,
            SourceRowNumber = sourceRowNumber,
            SourceCellsJson = sourceCellsJson,
            Classification = WorkforceImportRowClassification.Unresolved,
        };

    /// <summary>Record the recomputed resolution + display projection + issue state for this row.</summary>
    public void ApplyResolution(
        WorkforceImportRowClassification classification,
        Guid? candidateEmployeeId,
        Guid? resolvedOrgUnitId,
        string? resolvedManagerKey,
        bool hasWarning,
        string normalizedProposalJson,
        string searchText,
        string? issueStateJson)
    {
        Classification = classification;
        CandidateEmployeeId = candidateEmployeeId;
        ResolvedOrgUnitId = resolvedOrgUnitId;
        ResolvedManagerKey = resolvedManagerKey;
        HasWarning = hasWarning;
        NormalizedProposalJson = normalizedProposalJson;
        SearchText = searchText.Length > 1024 ? searchText[..1024] : searchText;
        IssueStateJson = issueStateJson;
        UpdatedAt = DateTime.UtcNow;
    }

    public void PurgePayload()
    {
        if (PayloadPurgedAt is not null) return;
        SourceCellsJson = null;
        NormalizedProposalJson = null;
        SearchText = null;
        IssueStateJson = null;
        PayloadPurgedAt = DateTime.UtcNow;
        UpdatedAt = PayloadPurgedAt;
    }
}

public enum WorkforceImportApplyStatus { Queued, Running, Succeeded, Failed, ReviewOutdated }

/// <summary>
/// The user-visible publication operation around the atomic orchestrator. One operation per attempt
/// (idempotent replay), with an observable phase and status the frontend can poll after reconnect.
/// Reconciliation on restart uses the attempt's terminal state as the source of truth so a crash
/// after canonical commit never re-applies. Publication is asynchronous because a large workforce
/// takes minutes to establish.
/// </summary>
public sealed class WorkforceImportApplyOperation : BaseEntity, ITenantEntity
{
    private WorkforceImportApplyOperation() { }

    public Guid TenantId { get; private set; }
    public Guid SessionId { get; private set; }
    public uint Version { get; private set; }
    public WorkforceImportApplyStatus Status { get; private set; }
    /// <summary>Product-safe phase label: Preparing, Validating, Saving.</summary>
    public string Phase { get; private set; } = "Preparing";
    public int ProcessedCount { get; private set; }
    public int? TotalCount { get; private set; }
    public Guid ActorUserId { get; private set; }
    public string ActorDisplayName { get; private set; } = string.Empty;
    /// <summary>The proposal fingerprint the administrator confirmed; the worker publishes only this proposal.</summary>
    public string ReviewedProposalFingerprint { get; private set; } = string.Empty;
    public DateTime QueuedAt { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public string? ResultJson { get; private set; }
    public string? FailureReason { get; private set; }
    public string? ReviewOutdatedJson { get; private set; }
    public string? LockedBy { get; private set; }
    public DateTime? LockedAt { get; private set; }

    public static WorkforceImportApplyOperation Queue(Guid tenantId, Guid sessionId, string reviewedProposalFingerprint, ImportActor actor)
    {
        var normalized = actor.Normalize();
        return new WorkforceImportApplyOperation
        {
            TenantId = tenantId,
            SessionId = sessionId,
            Status = WorkforceImportApplyStatus.Queued,
            Phase = "Preparing",
            ActorUserId = normalized.UserId,
            ActorDisplayName = normalized.DisplayName,
            ReviewedProposalFingerprint = reviewedProposalFingerprint,
            QueuedAt = DateTime.UtcNow,
        };
    }

    public bool IsTerminal => Status is WorkforceImportApplyStatus.Succeeded or WorkforceImportApplyStatus.Failed or WorkforceImportApplyStatus.ReviewOutdated;

    public void AcquireLock(string instanceId)
    {
        LockedBy = instanceId.Length > 64 ? instanceId[..64] : instanceId;
        LockedAt = DateTime.UtcNow;
        StartedAt ??= DateTime.UtcNow;
        Status = WorkforceImportApplyStatus.Running;
        Touch();
    }

    /// <summary>Re-queue a finished-unsuccessfully operation for a new publication of the reviewed proposal.</summary>
    public void Requeue(string reviewedProposalFingerprint, ImportActor actor)
    {
        var normalized = actor.Normalize();
        Status = WorkforceImportApplyStatus.Queued;
        Phase = "Preparing";
        ProcessedCount = 0;
        TotalCount = null;
        ReviewedProposalFingerprint = reviewedProposalFingerprint;
        ActorUserId = normalized.UserId;
        ActorDisplayName = normalized.DisplayName;
        QueuedAt = DateTime.UtcNow;
        CompletedAt = null;
        LockedBy = null;
        LockedAt = null;
        FailureReason = null;
        ReviewOutdatedJson = null;
        Touch();
    }

    public void SetPhase(string phase, int processed, int? total)
    {
        Phase = phase;
        if (processed > ProcessedCount) ProcessedCount = processed;
        TotalCount = total;
        Touch();
    }

    public void MarkSucceeded(string resultJson, int total)
    {
        Status = WorkforceImportApplyStatus.Succeeded;
        Phase = "Saved";
        ResultJson = resultJson;
        ProcessedCount = total;
        TotalCount = total;
        CompletedAt = DateTime.UtcNow;
        LockedBy = null;
        LockedAt = null;
        Touch();
    }

    public void MarkFailed(string reason)
    {
        Status = WorkforceImportApplyStatus.Failed;
        FailureReason = reason.Length > 2000 ? reason[..2000] : reason;
        CompletedAt = DateTime.UtcNow;
        LockedBy = null;
        LockedAt = null;
        Touch();
    }

    public void MarkReviewOutdated(string reviewOutdatedJson)
    {
        Status = WorkforceImportApplyStatus.ReviewOutdated;
        ReviewOutdatedJson = reviewOutdatedJson;
        CompletedAt = DateTime.UtcNow;
        LockedBy = null;
        LockedAt = null;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>A Workforce Import semantic run, under the workforce contract versions.</summary>
public sealed class WorkforceImportSemanticAttempt : ImportSemanticAttempt
{
    private WorkforceImportSemanticAttempt() { }

    public static WorkforceImportSemanticAttempt Start(
        Guid tenantId,
        Guid sessionId,
        int attemptOrdinal,
        ImportSemanticTrigger trigger,
        string sourceFingerprint,
        string inputFingerprint,
        string resultContractVersion,
        string dataContractVersion,
        string promptVersion,
        string provider,
        string model,
        IReadOnlyList<string> questionKeys)
    {
        var attempt = new WorkforceImportSemanticAttempt();
        attempt.Initialize(
            tenantId, sessionId, attemptOrdinal, trigger, sourceFingerprint, inputFingerprint,
            dataContractVersion, resultContractVersion, promptVersion, provider, model, questionKeys);
        return attempt;
    }
}

internal static class WorkforceImportJson
{
    private const int MaxDocumentBytes = 512 * 1024;

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    public static JsonSerializerOptions SerializerOptions => Options;

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    public static T Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Options)!;

    /// <summary>Validate that a decision document is well-formed, object-shaped, and bounded before persisting.</summary>
    public static string NormalizeDocument(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return "{}";
        if (System.Text.Encoding.UTF8.GetByteCount(json) > MaxDocumentBytes)
            throw new ArgumentException("The import decisions payload is too large.", nameof(json));
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Import decisions must be a JSON object.", nameof(json));
        return document.RootElement.GetRawText();
    }
}
