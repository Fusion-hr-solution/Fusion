using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class EmployeeImportApplyOperation : BaseEntity, ITenantEntity
{
    private const int MaxActorNameLength = 256;
    private const int MaxActorRoleLength = 128;
    private const int MaxLockOwnerLength = 64;
    private const int MaxFailureReasonLength = 2000;

    private EmployeeImportApplyOperation() { }

    public Guid TenantId { get; private set; }

    public uint Version { get; private set; }

    public Guid SessionId { get; private set; }

    public EmployeeImportApplyOperationStatus Status { get; private set; }

    public Guid ActorUserId { get; private set; }

    public string ActorFullName { get; private set; } = string.Empty;

    public string ActorRole { get; private set; } = string.Empty;

    public DateTime QueuedAt { get; private set; }

    public DateTime? StartedAt { get; private set; }

    public DateTime? CompletedAt { get; private set; }

    public DateTime? FailedAt { get; private set; }

    public DateTime? LockedAt { get; private set; }

    public string? LockedBy { get; private set; }

    public string? FailureReason { get; private set; }

    public Guid? HistoryId { get; private set; }

    public int? SourceRowCount { get; private set; }

    public int? ValidatedRowCount { get; private set; }

    public int ProcessedRowCount { get; private set; }

    public int? CreatedCount { get; private set; }

    public int? PublishedRowCount { get; private set; }

    public static EmployeeImportApplyOperation Queue(
        Guid tenantId,
        Guid sessionId,
        Guid actorUserId,
        string actorFullName,
        string actorRole,
        int sourceRowCount,
        int validatedRowCount,
        DateTime queuedAtUtc)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (sessionId == Guid.Empty)
            throw new ArgumentException("SessionId cannot be empty.", nameof(sessionId));
        if (actorUserId == Guid.Empty)
            throw new ArgumentException("ActorUserId cannot be empty.", nameof(actorUserId));
        if (string.IsNullOrWhiteSpace(actorFullName))
            throw new ArgumentException("ActorFullName cannot be empty.", nameof(actorFullName));
        if (string.IsNullOrWhiteSpace(actorRole))
            throw new ArgumentException("ActorRole cannot be empty.", nameof(actorRole));
        if (sourceRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(sourceRowCount));
        if (validatedRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(validatedRowCount));

        return new EmployeeImportApplyOperation
        {
            TenantId = tenantId,
            SessionId = sessionId,
            Status = EmployeeImportApplyOperationStatus.Queued,
            ActorUserId = actorUserId,
            ActorFullName = TrimToLength(actorFullName, MaxActorNameLength),
            ActorRole = TrimToLength(actorRole, MaxActorRoleLength),
            SourceRowCount = sourceRowCount,
            ValidatedRowCount = validatedRowCount,
            ProcessedRowCount = 0,
            QueuedAt = NormalizeUtc(queuedAtUtc, nameof(queuedAtUtc))
        };
    }

    public void AcquireLock(string instanceId, DateTime lockedAtUtc)
    {
        LockedBy = TrimToLength(instanceId, MaxLockOwnerLength);
        LockedAt = NormalizeUtc(lockedAtUtc, nameof(lockedAtUtc));
        Touch();
    }

    public void MarkRunning(DateTime startedAtUtc)
    {
        Status = EmployeeImportApplyOperationStatus.Running;
        StartedAt ??= NormalizeUtc(startedAtUtc, nameof(startedAtUtc));
        FailureReason = null;
        FailedAt = null;
        Touch();
    }

    public void RecordProgress(int processedRowCount)
    {
        if (processedRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(processedRowCount));

        if (ValidatedRowCount.HasValue && processedRowCount > ValidatedRowCount.Value)
            throw new ArgumentOutOfRangeException(nameof(processedRowCount));

        if (processedRowCount <= ProcessedRowCount)
            return;

        ProcessedRowCount = processedRowCount;
        Touch();
    }

    public void MarkSucceeded(
        Guid historyId,
        int sourceRowCount,
        int validatedRowCount,
        int createdCount,
        int publishedRowCount,
        DateTime completedAtUtc)
    {
        if (historyId == Guid.Empty)
            throw new ArgumentException("HistoryId cannot be empty.", nameof(historyId));

        Status = EmployeeImportApplyOperationStatus.Succeeded;
        HistoryId = historyId;
        SourceRowCount = sourceRowCount;
        ValidatedRowCount = validatedRowCount;
        ProcessedRowCount = validatedRowCount;
        CreatedCount = createdCount;
        PublishedRowCount = publishedRowCount;
        CompletedAt = NormalizeUtc(completedAtUtc, nameof(completedAtUtc));
        FailedAt = null;
        FailureReason = null;
        LockedAt = null;
        LockedBy = null;
        Touch();
    }

    public void MarkFailed(string failureReason, DateTime failedAtUtc)
    {
        Status = EmployeeImportApplyOperationStatus.Failed;
        FailedAt = NormalizeUtc(failedAtUtc, nameof(failedAtUtc));
        FailureReason = TrimToLength(failureReason, MaxFailureReasonLength);
        LockedAt = null;
        LockedBy = null;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string TrimToLength(string value, int maxLength)
    {
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static DateTime NormalizeUtc(DateTime value, string paramName) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => throw new ArgumentException(
            $"{paramName} must have DateTimeKind.Utc or DateTimeKind.Local; Unspecified is not allowed.",
            paramName)
    };
}

public enum EmployeeImportApplyOperationStatus
{
    Queued,
    Running,
    Succeeded,
    Failed
}
