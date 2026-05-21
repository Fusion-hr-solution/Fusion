using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidateRetentionRun : AggregateRoot
{
    public string TriggeredBy { get; set; } = string.Empty;
    public string TriggerSource { get; set; } = "Scheduled";
    public string RetentionAction { get; set; } = "Anonymize";
    public int RetentionPeriodDays { get; set; }
    public int CandidatesScanned { get; set; }
    public int CandidatesProcessed { get; set; }
    public int CandidatesAnonymized { get; set; }
    public int CandidatesDeleted { get; set; }
    public int CandidatesExpired { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

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
