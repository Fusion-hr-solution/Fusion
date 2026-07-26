using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

public enum ScheduledJobRunStatus
{
    Succeeded,
    Failed,
    Skipped
}

/// <summary>
/// Run-history ledger row for a scheduled-job execution. Cross-tenant (a sweep processes all
/// tenants in one tick), so this is not an <c>ITenantEntity</c> — TenantId is nullable and set only
/// when a run is meaningfully scoped to a single tenant. Written by the runner for operational
/// investigation.
/// </summary>
public class ScheduledJobRun : BaseEntity
{
    private ScheduledJobRun() { }

    public string JobName { get; private set; } = string.Empty;
    public Guid? TenantId { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public ScheduledJobRunStatus Status { get; private set; }
    public int ItemsAffected { get; private set; }
    public string? Error { get; private set; }

    public static ScheduledJobRun Start(string jobName, DateTime startedAt, Guid? tenantId = null)
    {
        if (string.IsNullOrWhiteSpace(jobName))
            throw new ArgumentException("JobName cannot be empty.", nameof(jobName));

        return new ScheduledJobRun
        {
            Id = Guid.NewGuid(),
            JobName = jobName.Trim(),
            TenantId = tenantId,
            StartedAt = startedAt,
            Status = ScheduledJobRunStatus.Succeeded,
        };
    }

    public void Complete(ScheduledJobRunStatus status, int itemsAffected, DateTime completedAt, string? error = null)
    {
        Status = status;
        ItemsAffected = itemsAffected;
        CompletedAt = completedAt;
        Error = error is { Length: > 0 } ? error[..Math.Min(error.Length, 2000)] : null;
    }
}
