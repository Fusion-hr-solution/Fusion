using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidateRetentionSettings : AggregateRoot
{
    public bool Enabled { get; set; } = false;
    public string RetentionAction { get; set; } = "Anonymize";
    public int RetentionPeriodDays { get; set; } = 90;
    public int ScanIntervalHours { get; set; } = 24;
    public DateTime? LastRunAtUtc { get; set; }
    public DateTime? SweepLockedAtUtc { get; set; }

    public void SetCreatedAt(DateTime createdAt)
    {
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public void SetUpdatedAt(DateTime updatedAt)
    {
        UpdatedAt = updatedAt;
    }
}
