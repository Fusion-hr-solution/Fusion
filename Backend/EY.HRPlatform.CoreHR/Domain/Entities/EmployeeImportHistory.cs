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

    public int ValidatedRowCount { get; private set; }

    public int CreatedCount { get; private set; }

    public int UnchangedRowCount { get; private set; }

    /// <summary>
    /// Rows whose canonical changes were actually committed by this publication
    /// (creates plus controlled-update changes). Unchanged rows are never counted as published.
    /// </summary>
    public int PublishedRowCount { get; private set; }

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
        int validatedRowCount,
        int createdCount,
        int unchangedRowCount,
        int publishedRowCount,
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

        if (validatedRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(validatedRowCount));

        if (createdCount < 0)
            throw new ArgumentOutOfRangeException(nameof(createdCount));

        if (unchangedRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(unchangedRowCount));

        if (publishedRowCount < 0)
            throw new ArgumentOutOfRangeException(nameof(publishedRowCount));

        if (validatedRowCount > sourceRowCount)
            throw new ArgumentException("ValidatedRowCount cannot exceed SourceRowCount.", nameof(validatedRowCount));

        if (createdCount > publishedRowCount)
            throw new ArgumentException("CreatedCount cannot exceed PublishedRowCount.", nameof(createdCount));

        if (publishedRowCount + unchangedRowCount > validatedRowCount)
            throw new ArgumentException("PublishedRowCount and UnchangedRowCount cannot exceed ValidatedRowCount.");

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
            ValidatedRowCount = validatedRowCount,
            CreatedCount = createdCount,
            UnchangedRowCount = unchangedRowCount,
            PublishedRowCount = publishedRowCount,
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