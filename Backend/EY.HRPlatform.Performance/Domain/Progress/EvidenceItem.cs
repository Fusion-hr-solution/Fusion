using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>
/// One optional piece of evidence attached to a progress update: a stored file, an external link,
/// or a short supporting reference. Persisted module-locally and tenant-isolated; a file's binary
/// lives behind the evidence store keyed by <see cref="StorageKey"/> while this row holds its
/// metadata. Each item belongs to exactly one progress update (product-spec §29).
/// </summary>
public sealed class EvidenceItem : PerformanceChildEntity
{
    private EvidenceItem() { }

    public Guid ProgressUpdateId { get; private set; }
    public EvidenceKind Kind { get; private set; }

    // File metadata.
    public string? FileName { get; private set; }
    public string? ContentType { get; private set; }
    public long? SizeBytes { get; private set; }
    public string? StorageKey { get; private set; }

    // Link / reference.
    public string? Url { get; private set; }
    public string? ReferenceText { get; private set; }

    public static EvidenceItem File(Guid tenantId, string fileName, string contentType, long sizeBytes, string storageKey)
    {
        if (string.IsNullOrWhiteSpace(fileName)) throw new ArgumentException("A file evidence item requires a file name.", nameof(fileName));
        if (string.IsNullOrWhiteSpace(storageKey)) throw new ArgumentException("A file evidence item requires a storage key.", nameof(storageKey));
        return new EvidenceItem
        {
            TenantId = tenantId,
            Kind = EvidenceKind.File,
            FileName = fileName.Trim(),
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            SizeBytes = sizeBytes,
            StorageKey = storageKey,
        };
    }

    public static EvidenceItem Link(Guid tenantId, string url, string? label)
    {
        if (string.IsNullOrWhiteSpace(url)) throw new ArgumentException("A link evidence item requires a URL.", nameof(url));
        return new EvidenceItem
        {
            TenantId = tenantId,
            Kind = EvidenceKind.Link,
            Url = url.Trim(),
            ReferenceText = string.IsNullOrWhiteSpace(label) ? null : label.Trim(),
        };
    }

    public static EvidenceItem Reference(Guid tenantId, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) throw new ArgumentException("A reference evidence item requires text.", nameof(text));
        return new EvidenceItem
        {
            TenantId = tenantId,
            Kind = EvidenceKind.Reference,
            ReferenceText = text.Trim(),
        };
    }

    internal void AttachTo(Guid progressUpdateId) => ProgressUpdateId = progressUpdateId;
}
