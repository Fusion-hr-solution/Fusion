using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class EmployeeImportHistory : BaseEntity, ITenantEntity
{
    private const string AppliedStatus = "Applied";

    private EmployeeImportHistory() { }

    public Guid TenantId { get; private set; }

    public uint Version { get; private set; }

    public Guid SessionId { get; private set; }

    public string SourceFileName { get; private set; } = string.Empty;

    public long SourceFileSizeBytes { get; private set; }

    public int SourceRowCount { get; private set; }

    public int ValidRowCount { get; private set; }

    public int CreatedCount { get; private set; }

    public int SkippedCount { get; private set; }

    public string Status { get; private set; } = string.Empty;

    public DateTime AppliedAt { get; private set; }

    public Guid ActorUserId { get; private set; }

    public string ActorFullName { get; private set; } = string.Empty;

    public string ActorRole { get; private set; } = string.Empty;

    public string? FailureReason { get; private set; }

    public string EventType { get; private set; } = string.Empty;

    public int ErrorCount { get; private set; }

    public int WarningCount { get; private set; }

    public static EmployeeImportHistory CreateApplied(
        Guid tenantId,
        Guid sessionId,
        string sourceFileName,
        long sourceFileSizeBytes,
        int sourceRowCount,
        int validRowCount,
        int createdCount,
        int skippedCount,
        DateTime appliedAtUtc,
        Guid actorUserId,
        string actorFullName,
        string actorRole)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (sessionId == Guid.Empty)
            throw new ArgumentException("SessionId cannot be empty.", nameof(sessionId));

        if (string.IsNullOrWhiteSpace(sourceFileName))
            throw new ArgumentException("SourceFileName cannot be empty.", nameof(sourceFileName));

        if (sourceRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(sourceRowCount));

        if (validRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(validRowCount));

        if (createdCount < 0)
            throw new ArgumentOutOfRangeException(nameof(createdCount));

        if (skippedCount < 0)
            throw new ArgumentOutOfRangeException(nameof(skippedCount));

        if (validRowCount > sourceRowCount)
            throw new ArgumentException("ValidRowCount cannot exceed SourceRowCount.", nameof(validRowCount));

        if (createdCount + skippedCount > validRowCount)
            throw new ArgumentException("CreatedCount and SkippedCount cannot exceed ValidRowCount.");

        if (actorUserId == Guid.Empty)
            throw new ArgumentException("ActorUserId cannot be empty.", nameof(actorUserId));

        if (string.IsNullOrWhiteSpace(actorFullName))
            throw new ArgumentException("ActorFullName cannot be empty.", nameof(actorFullName));

        if (string.IsNullOrWhiteSpace(actorRole))
            throw new ArgumentException("ActorRole cannot be empty.", nameof(actorRole));

        var normalizedAppliedAt = appliedAtUtc.Kind switch
        {
            DateTimeKind.Utc => appliedAtUtc,
            DateTimeKind.Local => appliedAtUtc.ToUniversalTime(),
            _ => throw new ArgumentException(
                "AppliedAt must have DateTimeKind.Utc or DateTimeKind.Local; Unspecified is not allowed.",
                nameof(appliedAtUtc))
        };

        return new EmployeeImportHistory
        {
            TenantId = tenantId,
            SessionId = sessionId,
            SourceFileName = sourceFileName.Trim(),
            SourceFileSizeBytes = sourceFileSizeBytes,
            SourceRowCount = sourceRowCount,
            ValidRowCount = validRowCount,
            CreatedCount = createdCount,
            SkippedCount = skippedCount,
            Status = AppliedStatus,
            AppliedAt = normalizedAppliedAt,
            ActorUserId = actorUserId,
            ActorFullName = actorFullName.Trim(),
            ActorRole = actorRole.Trim(),
            EventType = "Import",
            ErrorCount = 0,
            WarningCount = 0
        };
    }
}