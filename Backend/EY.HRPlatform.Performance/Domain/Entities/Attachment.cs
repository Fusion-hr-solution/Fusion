using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public enum AttachmentStatus
{
    Pending,
    Committed
}

/// <summary>
/// Tenant-scoped attachment metadata. Bytes live behind <see cref="Infrastructure.Attachments.IAttachmentStorage"/>,
/// keyed by <see cref="StorageKey"/>. Ownership (which resource an attachment belongs to and whether a
/// caller may see it) is delegated to the consuming feature via <see cref="OwnerType"/>/<see cref="OwnerId"/>;
/// the attachment layer only enforces tenant scope and lifecycle. A row starts <see cref="AttachmentStatus.Pending"/>
/// and becomes <see cref="AttachmentStatus.Committed"/> once bytes are stored; pending rows that never commit
/// are reaped by the cleanup sweep.
/// </summary>
public class Attachment : BaseEntity, ITenantEntity
{
    private Attachment() { }

    public Guid TenantId { get; private set; }

    /// <summary>Opaque owning-resource type (e.g. FeedbackResponse, ExceptionCase).</summary>
    public string OwnerType { get; private set; } = string.Empty;

    /// <summary>Owning-resource id; may be null when the attachment is uploaded before its owner exists.</summary>
    public Guid? OwnerId { get; private set; }

    public Guid UploaderUserId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public string StorageKey { get; private set; } = string.Empty;
    public AttachmentStatus Status { get; private set; }
    public DateTime? CommittedAt { get; private set; }

    public static Attachment CreatePending(
        Guid tenantId,
        string ownerType,
        Guid? ownerId,
        Guid uploaderUserId,
        string fileName,
        string contentType,
        long sizeBytes)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(ownerType))
            throw new ArgumentException("OwnerType cannot be empty.", nameof(ownerType));
        if (string.IsNullOrWhiteSpace(fileName))
            throw new ArgumentException("FileName cannot be empty.", nameof(fileName));
        if (sizeBytes < 0)
            throw new ArgumentException("SizeBytes cannot be negative.", nameof(sizeBytes));

        var id = Guid.NewGuid();
        return new Attachment
        {
            Id = id,
            TenantId = tenantId,
            OwnerType = ownerType.Trim(),
            OwnerId = ownerId,
            UploaderUserId = uploaderUserId,
            FileName = fileName.Trim(),
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType.Trim(),
            SizeBytes = sizeBytes,
            StorageKey = $"{tenantId}/{id}",
            Status = AttachmentStatus.Pending,
        };
    }

    public void Commit(DateTime committedAt)
    {
        if (Status == AttachmentStatus.Committed)
        {
            return;
        }

        Status = AttachmentStatus.Committed;
        CommittedAt = committedAt;
        UpdatedAt = committedAt;
    }
}
