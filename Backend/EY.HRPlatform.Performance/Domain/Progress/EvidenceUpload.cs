using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>A file staged for one owner's progress update on one objective.</summary>
public sealed class EvidenceUpload : PerformanceAggregate
{
    private EvidenceUpload() { }
    public Guid CycleId { get; private set; }
    public Guid ObjectiveId { get; private set; }
    public Guid UploaderEmployeeId { get; private set; }
    public string StorageKey { get; private set; } = string.Empty;
    public string FileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public DateTime? ClaimedAt { get; private set; }

    public static EvidenceUpload Stage(Guid tenantId, Guid cycleId, Guid objectiveId, Guid uploaderEmployeeId,
        string storageKey, string fileName, string contentType, long sizeBytes)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || objectiveId == Guid.Empty || uploaderEmployeeId == Guid.Empty)
            throw new ArgumentException("Evidence tenant, Cycle, objective and uploader are required.");
        if (string.IsNullOrWhiteSpace(storageKey) || string.IsNullOrWhiteSpace(fileName) || string.IsNullOrWhiteSpace(contentType)
            || sizeBytes is <= 0 or > 20 * 1024 * 1024)
            throw new ArgumentException("A valid evidence file is required.");
        return new EvidenceUpload
        {
            TenantId = tenantId, CycleId = cycleId, ObjectiveId = objectiveId, UploaderEmployeeId = uploaderEmployeeId,
            StorageKey = storageKey, FileName = fileName, ContentType = contentType, SizeBytes = sizeBytes,
        };
    }

    public void Claim(Guid objectiveId, Guid uploaderEmployeeId)
    {
        if (ObjectiveId != objectiveId || UploaderEmployeeId != uploaderEmployeeId || ClaimedAt is not null)
            throw new ArgumentException("This upload is unavailable for this progress update. Attach the file again.");
        ClaimedAt = DateTime.UtcNow;
        MarkUpdated();
    }
}
