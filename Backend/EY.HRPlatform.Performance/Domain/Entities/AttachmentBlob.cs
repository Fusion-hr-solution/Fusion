namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The bytes behind an attachment, when the module is configured to store them in the database
/// (design D11).
/// </summary>
/// <remarks>
/// Deliberately not an <c>ITenantEntity</c>: the tenant boundary is enforced on the
/// <see cref="Attachment"/> metadata row, which is tenant-filtered, and a caller only ever reaches
/// bytes through it. The storage key is itself tenant-partitioned
/// (<c>{tenantId}/{attachmentId}</c>), so a key from one tenant cannot name another's bytes.
/// </remarks>
public sealed class AttachmentBlob
{
    private AttachmentBlob() { }

    public Guid Id { get; private set; }

    /// <summary>Opaque, tenant-partitioned key matching <see cref="Attachment.StorageKey"/>.</summary>
    public string StorageKey { get; private set; } = string.Empty;

    public byte[] Content { get; private set; } = [];
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public static AttachmentBlob Create(string storageKey, byte[] content)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            throw new ArgumentException("A storage key is required.", nameof(storageKey));
        }

        return new AttachmentBlob
        {
            Id = Guid.NewGuid(),
            StorageKey = storageKey,
            Content = content,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Replace(byte[] content)
    {
        Content = content;
        UpdatedAt = DateTime.UtcNow;
    }
}
