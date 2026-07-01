using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>An independently trackable checkpoint within a SMART objective.</summary>
public sealed class PerformanceObjectiveMilestone : BaseEntity, ITenantEntity
{
    private PerformanceObjectiveMilestone() { }

    public Guid TenantId { get; private set; }
    public Guid ObjectiveId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateTime DueDate { get; private set; }
    public bool IsCompleted { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public static PerformanceObjectiveMilestone Create(Guid tenantId, Guid objectiveId, string title, DateTime dueDate)
    {
        if (tenantId == Guid.Empty || objectiveId == Guid.Empty)
            throw new ArgumentException("Tenant and objective are required.");
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Milestone title is required.", nameof(title));
        if (title.Trim().Length > 300)
            throw new ArgumentException("Milestone title cannot exceed 300 characters.", nameof(title));
        if (dueDate == default)
            throw new ArgumentException("A valid milestone due date is required.", nameof(dueDate));

        return new PerformanceObjectiveMilestone
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ObjectiveId = objectiveId,
            Title = title.Trim(),
            DueDate = dueDate.Kind == DateTimeKind.Utc ? dueDate : dueDate.ToUniversalTime()
        };
    }

    public void Complete(DateTime occurredAt)
    {
        if (IsCompleted)
            throw new InvalidOperationException("Milestone is already completed.");
        IsCompleted = true;
        CompletedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : occurredAt.ToUniversalTime();
        UpdatedAt = DateTime.UtcNow;
    }
}
