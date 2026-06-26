using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>US-8.2.3 — an audit record of one applied training import (ADR 0008).</summary>
public class TrainingImportHistory : BaseEntity
{
    public Guid CreatedByEmployeeId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public int Imported { get; private set; }
    public int Updated { get; private set; }
    public int Skipped { get; private set; }
    public int Failed { get; private set; }

    private TrainingImportHistory() { }

    public TrainingImportHistory(
        Guid createdByEmployeeId, string fileName, int imported, int updated, int skipped, int failed)
    {
        CreatedByEmployeeId = createdByEmployeeId;
        FileName = fileName;
        Imported = imported;
        Updated = updated;
        Skipped = skipped;
        Failed = failed;
    }
}
