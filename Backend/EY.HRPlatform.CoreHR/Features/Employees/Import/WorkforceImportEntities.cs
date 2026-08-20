using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import;

// Workforce Import — the one canonical import subsystem. These entities replace the
// retired Employee Import product contract (BusinessChange/Correction/existing-employee
// mutation) with create-only establishment: temporary, resumable, idempotent, ETag-
// concurrent sessions whose source/rows are purged on every terminal outcome while
// durable provenance survives. See openspec/changes/workforce-import-establishment.

public enum WorkforceImportStatus
{
    Intake,
    Interpreting,
    Reviewing,
    Ready,
    Applying,
    Committed,
    Discarded,
    Expired,
}

public enum WorkforceImportRowClassification
{
    /// <summary>Row has not been interpreted/resolved yet.</summary>
    Unresolved,
    NewEmployee,
    ExistingAnchor,
    Excluded,
    NeedsAttention,
}

public sealed record WorkforceImportActor(Guid UserId, string DisplayName)
{
    public WorkforceImportActor Normalize()
        => new(UserId, string.IsNullOrWhiteSpace(DisplayName)
            ? "Unknown"
            : DisplayName.Trim()[..Math.Min(DisplayName.Trim().Length, 256)]);
}

/// <summary>
/// The tenant-owned Workforce Import workspace. At most one is active per tenant for MVP.
/// Advances Intake→Interpreting→Reviewing→Ready→Applying→Committed, or terminates as
/// Discarded/Expired. Once Applying it is frozen: only apply-state observation is allowed.
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

    public string DecisionsJson { get; private set; } = "{}";
    public int DecisionRevision { get; private set; }
    public DateTime? DecisionsUpdatedAt { get; private set; }
    public Guid? DecisionsUpdatedByUserId { get; private set; }
    public string? DecisionsUpdatedByDisplayName { get; private set; }

    public int NewCount { get; private set; }
    public int ExistingAnchorCount { get; private set; }
    public int NeedsAttentionCount { get; private set; }
    public int ExcludedCount { get; private set; }

    public string? ReviewDigest { get; private set; }
    public string? CanonicalObservationDigest { get; private set; }

    public DateTime ExpiresAt { get; private set; }
    public DateTime? PayloadPurgedAt { get; private set; }

    public DateTime? DiscardedAt { get; private set; }
    public Guid? DiscardedByUserId { get; private set; }
    public DateTime? ExpiredAt { get; private set; }
    public DateTime? AppliedStartedAt { get; private set; }
    public DateTime? CommittedAt { get; private set; }
    public Guid? CommittedByUserId { get; private set; }
    public string? CommittedByDisplayName { get; private set; }
    public string? FinalSemanticDigest { get; private set; }
    public string? CommitResultJson { get; private set; }
    public string? FinalProvenanceJson { get; private set; }

    public WorkforceImportSource Source { get; private set; } = null!;
    private readonly List<WorkforceImportRow> _rows = [];
    public IReadOnlyCollection<WorkforceImportRow> Rows => _rows;

    /// <summary>Default active-session retention window; configurable by the caller.</summary>
    public static readonly TimeSpan DefaultRetention = TimeSpan.FromDays(7);

    public static WorkforceImportSession Create(
        Guid tenantId,
        DateOnly baselineDate,
        Guid creationToken,
        string creationFingerprint,
        string selectedSheetName,
        WorkforceImportActor actor,
        DateTime nowUtc,
        TimeSpan? retention = null)
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
            Status = WorkforceImportStatus.Intake,
            StartedByUserId = normalized.UserId,
            StartedByDisplayName = normalized.DisplayName,
            LastUpdatedByUserId = normalized.UserId,
            LastUpdatedByDisplayName = normalized.DisplayName,
            ExpiresAt = nowUtc.Add(retention ?? DefaultRetention),
        };
    }

    public void AttachSource(WorkforceImportSource source) => Source = source;

    public void ReplaceRows(IEnumerable<WorkforceImportRow> rows)
    {
        EnsureMutable();
        _rows.Clear();
        _rows.AddRange(rows);
    }

    public void ChangeBaselineDate(DateOnly date, WorkforceImportActor actor, DateTime nowUtc)
    {
        EnsureMutable();
        if (date > DateOnly.FromDateTime(nowUtc))
            throw new InvalidOperationException("A future Workforce-as-of date is not allowed; use Hire for future employees.");
        BaselineDate = date;
        Touch(actor);
    }

    public void MoveToInterpreting(WorkforceImportActor actor)
    {
        EnsureMutable();
        if (Status is WorkforceImportStatus.Intake or WorkforceImportStatus.Interpreting or WorkforceImportStatus.Reviewing or WorkforceImportStatus.Ready)
            Status = WorkforceImportStatus.Interpreting;
        Touch(actor);
    }

    public void MoveToReviewing(
        int newCount,
        int existingAnchorCount,
        int needsAttentionCount,
        int excludedCount,
        string reviewDigest,
        string canonicalObservationDigest,
        WorkforceImportActor actor)
    {
        EnsureMutable();
        NewCount = newCount;
        ExistingAnchorCount = existingAnchorCount;
        NeedsAttentionCount = needsAttentionCount;
        ExcludedCount = excludedCount;
        ReviewDigest = reviewDigest;
        CanonicalObservationDigest = canonicalObservationDigest;
        Status = needsAttentionCount == 0 && newCount > 0
            ? WorkforceImportStatus.Ready
            : WorkforceImportStatus.Reviewing;
        Touch(actor);
    }

    public void ReplaceDecisions(string decisionsJson, WorkforceImportActor actor)
    {
        EnsureMutable();
        DecisionsJson = WorkforceImportJson.NormalizeDecisions(decisionsJson);
        DecisionRevision++;
        var normalized = actor.Normalize();
        DecisionsUpdatedAt = DateTime.UtcNow;
        DecisionsUpdatedByUserId = normalized.UserId;
        DecisionsUpdatedByDisplayName = normalized.DisplayName;
        Touch(actor);
    }

    /// <summary>
    /// Enter the frozen apply state. Once Applying, no baseline/decision/exclusion change,
    /// semantic apply, source replacement, discard, or expiry may occur — only observation.
    /// </summary>
    public void BeginApply(string reviewDigest, WorkforceImportActor actor)
    {
        if (Status is not (WorkforceImportStatus.Reviewing or WorkforceImportStatus.Ready))
            throw new InvalidOperationException("Only a reviewable session can begin apply.");
        ReviewDigest = reviewDigest;
        AppliedStartedAt = DateTime.UtcNow;
        Status = WorkforceImportStatus.Applying;
        Touch(actor);
    }

    /// <summary>A safely-reviewable pre-canonical failure returns the frozen session to review.</summary>
    public void ReturnToReview(WorkforceImportActor actor)
    {
        if (Status != WorkforceImportStatus.Applying)
            throw new InvalidOperationException("Only an applying session can return to review.");
        Status = WorkforceImportStatus.Reviewing;
        AppliedStartedAt = null;
        Touch(actor);
    }

    public void Commit(
        string semanticDigest,
        string commitResultJson,
        string finalProvenanceJson,
        WorkforceImportActor actor)
    {
        if (Status != WorkforceImportStatus.Applying)
            throw new InvalidOperationException("Only an applying session can be committed.");
        var normalized = actor.Normalize();
        Status = WorkforceImportStatus.Committed;
        CommittedAt = DateTime.UtcNow;
        CommittedByUserId = normalized.UserId;
        CommittedByDisplayName = normalized.DisplayName;
        FinalSemanticDigest = semanticDigest;
        CommitResultJson = commitResultJson;
        FinalProvenanceJson = finalProvenanceJson;
        Touch(actor);
        PurgePayload();
    }

    /// <summary>
    /// Terminally complete a legitimate no-work import (no rows / nothing new / nothing included):
    /// a meaningful completed outcome distinct from Discard, with an empty result, no Apply operation,
    /// and temporary-PII purge. Records history so the journey is not mistaken for abandonment.
    /// </summary>
    public void CompleteNoWork(WorkforceImportActor actor)
    {
        if (Status is not (WorkforceImportStatus.Intake or WorkforceImportStatus.Interpreting or WorkforceImportStatus.Reviewing or WorkforceImportStatus.Ready))
            throw new InvalidOperationException("Only an active session can be completed.");
        if (NewCount > 0)
            throw new InvalidOperationException("This import has new employees to add; use Complete import.");
        Status = WorkforceImportStatus.Committed;
        CommittedAt = DateTime.UtcNow;
        var normalized = actor.Normalize();
        CommittedByUserId = normalized.UserId;
        CommittedByDisplayName = normalized.DisplayName;
        CommitResultJson = "{\"addedEmployeeCount\":0,\"noWork\":true}";
        Touch(actor);
        PurgePayload();
    }

    public bool Discard(WorkforceImportActor actor)
    {
        if (Status is WorkforceImportStatus.Discarded or WorkforceImportStatus.Committed or WorkforceImportStatus.Expired) return false;
        if (Status == WorkforceImportStatus.Applying)
            throw new InvalidOperationException("An import cannot be discarded while it is being completed.");
        Status = WorkforceImportStatus.Discarded;
        DiscardedAt = DateTime.UtcNow;
        DiscardedByUserId = actor.Normalize().UserId;
        Touch(actor);
        PurgePayload();
        return true;
    }

    public bool Expire(DateTime nowUtc)
    {
        if (Status is WorkforceImportStatus.Committed or WorkforceImportStatus.Discarded or WorkforceImportStatus.Expired) return false;
        // A session mid-apply is never expired out from under the worker.
        if (Status == WorkforceImportStatus.Applying) return false;
        if (nowUtc < ExpiresAt) return false;
        Status = WorkforceImportStatus.Expired;
        ExpiredAt = nowUtc;
        UpdatedAt = nowUtc;
        PurgePayload();
        return true;
    }

    public bool IsActive => Status is WorkforceImportStatus.Intake or WorkforceImportStatus.Interpreting
        or WorkforceImportStatus.Reviewing or WorkforceImportStatus.Ready;

    public bool IsTerminal => Status is WorkforceImportStatus.Committed or WorkforceImportStatus.Discarded or WorkforceImportStatus.Expired;

    private void PurgePayload()
    {
        Source?.PurgePayload();
        foreach (var row in _rows) row.PurgePayload();
        if (PayloadPurgedAt is null) PayloadPurgedAt = DateTime.UtcNow;
    }

    private void EnsureMutable()
    {
        if (Status == WorkforceImportStatus.Applying)
            throw new InvalidOperationException("The import is being completed and cannot be changed.");
        if (IsTerminal)
            throw new InvalidOperationException("A terminal import cannot be changed.");
    }

    private void Touch(WorkforceImportActor actor)
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

    /// <summary>Swap in a replacement source file's bytes and metadata on the same source record.</summary>
    public void ReplaceContent(
        string originalFileName, string sourceFormat, string contentType, string sha256,
        string selectedSheetName, string selectedRange, int columnCount, int rowCount, string columnsJson, byte[] rawBytes)
    {
        OriginalFileName = originalFileName;
        SourceFormat = sourceFormat;
        ContentType = contentType;
        ByteLength = rawBytes.LongLength;
        Sha256 = sha256;
        RawBytes = rawBytes;
        PayloadPurgedAt = null;
        UpdateInterpretation(selectedSheetName, selectedRange, columnCount, rowCount, columnsJson);
    }

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
/// One temporary record per source data row, so review can page/filter/target-update and
/// grouped resolution can update many rows without rebuilding a monolithic 10k-row JSON blob.
/// Source and normalized PII are purged on every terminal outcome.
/// </summary>
public sealed class WorkforceImportRow : BaseEntity, ITenantEntity
{
    private WorkforceImportRow() { }

    public Guid SessionId { get; private set; }
    public Guid TenantId { get; private set; }
    public int SourceRowNumber { get; private set; }
    public string? SourceCellsJson { get; private set; }
    public string? NormalizedProposalJson { get; private set; }
    public Guid? CandidateEmployeeId { get; private set; }
    public Guid? ResolvedOrgUnitId { get; private set; }
    public string? ResolvedManagerKey { get; private set; }
    public WorkforceImportRowClassification Classification { get; private set; }
    public string? IssueStateJson { get; private set; }
    public bool IsExcluded { get; private set; }
    public string? DecisionRefsJson { get; private set; }
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
        bool isExcluded,
        string normalizedProposalJson,
        string? issueStateJson)
    {
        Classification = classification;
        CandidateEmployeeId = candidateEmployeeId;
        ResolvedOrgUnitId = resolvedOrgUnitId;
        ResolvedManagerKey = resolvedManagerKey;
        IsExcluded = isExcluded;
        NormalizedProposalJson = normalizedProposalJson;
        IssueStateJson = issueStateJson;
        UpdatedAt = DateTime.UtcNow;
    }

    public void PurgePayload()
    {
        if (PayloadPurgedAt is not null) return;
        SourceCellsJson = null;
        NormalizedProposalJson = null;
        IssueStateJson = null;
        DecisionRefsJson = null;
        PayloadPurgedAt = DateTime.UtcNow;
        UpdatedAt = PayloadPurgedAt;
    }
}

/// <summary>
/// Durable import provenance that survives the terminal PII purge: what was established,
/// by whom, from which source hash, and the created Employee keys — without retaining raw rows.
/// </summary>
public sealed class WorkforceImportHistory : BaseEntity, ITenantEntity
{
    private WorkforceImportHistory() { }

    public Guid TenantId { get; private set; }
    public Guid SessionId { get; private set; }
    public DateOnly BaselineDate { get; private set; }
    public string SourceFileName { get; private set; } = string.Empty;
    public string Sha256 { get; private set; } = string.Empty;
    public Guid ActorUserId { get; private set; }
    public string ActorDisplayName { get; private set; } = string.Empty;
    public DateTime CommittedAt { get; private set; }
    public int AddedEmployeeCount { get; private set; }
    public int ExistingAnchorCount { get; private set; }
    public int ExcludedCount { get; private set; }
    public string CreatedEmployeeKeysJson { get; private set; } = "[]";
    public string? MappingResolutionSummaryJson { get; private set; }

    public static WorkforceImportHistory Create(
        Guid tenantId,
        Guid sessionId,
        DateOnly baselineDate,
        string sourceFileName,
        string sha256,
        WorkforceImportActor actor,
        DateTime committedAt,
        int addedEmployeeCount,
        int existingAnchorCount,
        int excludedCount,
        string createdEmployeeKeysJson,
        string? mappingResolutionSummaryJson)
    {
        var normalized = actor.Normalize();
        return new WorkforceImportHistory
        {
            TenantId = tenantId,
            SessionId = sessionId,
            BaselineDate = baselineDate,
            SourceFileName = sourceFileName,
            Sha256 = sha256,
            ActorUserId = normalized.UserId,
            ActorDisplayName = normalized.DisplayName,
            CommittedAt = committedAt,
            AddedEmployeeCount = addedEmployeeCount,
            ExistingAnchorCount = existingAnchorCount,
            ExcludedCount = excludedCount,
            CreatedEmployeeKeysJson = createdEmployeeKeysJson,
            MappingResolutionSummaryJson = mappingResolutionSummaryJson,
        };
    }
}

public enum WorkforceImportApplyStatus { Queued, Running, Succeeded, Failed, ReviewOutdated }

/// <summary>
/// The user-visible Apply operation around the atomic orchestrator. One operation per session
/// (idempotent replay), with an observable phase and status the frontend can poll after reconnect.
/// Reconciliation on restart uses the session's terminal state as the source of truth so a crash
/// after canonical commit never re-applies.
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
    public DateTime QueuedAt { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public string? ResultJson { get; private set; }
    public string? FailureReason { get; private set; }
    public string? ReviewOutdatedJson { get; private set; }
    public string? LockedBy { get; private set; }
    public DateTime? LockedAt { get; private set; }

    public static WorkforceImportApplyOperation Queue(Guid tenantId, Guid sessionId, WorkforceImportActor actor)
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

    /// <summary>Re-queue a stale Running/locked operation for safe retry after a process restart.</summary>
    public void Requeue()
    {
        Status = WorkforceImportApplyStatus.Queued;
        Phase = "Preparing";
        ProcessedCount = 0;
        LockedBy = null;
        LockedAt = null;
        FailureReason = null;
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

internal static class WorkforceImportJson
{
    private const int MaxDecisionBytes = 512 * 1024;

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    public static T Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Options)!;

    /// <summary>Validate that decisions are well-formed, object-shaped, and bounded before persisting.</summary>
    public static string NormalizeDecisions(string decisionsJson)
    {
        if (string.IsNullOrWhiteSpace(decisionsJson)) return "{}";
        if (System.Text.Encoding.UTF8.GetByteCount(decisionsJson) > MaxDecisionBytes)
            throw new ArgumentException("The import decisions payload is too large.", nameof(decisionsJson));
        using var document = JsonDocument.Parse(decisionsJson);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Import decisions must be a JSON object.", nameof(decisionsJson));
        return document.RootElement.GetRawText();
    }
}
