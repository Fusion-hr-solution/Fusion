using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// US-8.2.3 — a staged, expiring snapshot of a parsed import workbook and its validation verdict,
/// held between upload and confirm so the admin can preview before anything is created (ADR 0008).
/// </summary>
public class TrainingImportSession : BaseEntity
{
    public Guid CreatedByEmployeeId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public ImportSessionStatus Status { get; private set; } = ImportSessionStatus.PreviewReady;
    public DateTime ExpiresAt { get; private set; }

    /// <summary>Serialized parsed-and-validated preview (rows, issues, summary).</summary>
    public string PayloadJson { get; private set; } = "{}";

    private TrainingImportSession() { }

    public TrainingImportSession(Guid createdByEmployeeId, string fileName, string payloadJson, DateTime expiresAt)
    {
        CreatedByEmployeeId = createdByEmployeeId;
        FileName = fileName;
        PayloadJson = payloadJson;
        ExpiresAt = expiresAt;
    }

    public bool IsExpired(DateTime nowUtc) => nowUtc >= ExpiresAt;

    public void MarkApplied()
    {
        Status = ImportSessionStatus.Applied;
        UpdatedAt = DateTime.UtcNow;
    }
}
