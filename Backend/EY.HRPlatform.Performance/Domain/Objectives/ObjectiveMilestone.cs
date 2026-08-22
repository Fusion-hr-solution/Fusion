using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Objectives;

/// <summary>
/// A weighted milestone within a weighted-milestones objective. A milestone is either
/// incomplete or completed — no partial credit (performance-objective-measurement).
/// </summary>
public sealed class ObjectiveMilestone : PerformanceChildEntity
{
    private ObjectiveMilestone() { }

    public Guid ObjectiveId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public decimal Weight { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public bool IsCompleted { get; private set; }

    public static ObjectiveMilestone Create(Guid tenantId, string title, decimal weight, DateOnly? dueDate)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("A milestone requires a title.", nameof(title));

        if (weight <= 0m || weight > 100m)
            throw new ArgumentOutOfRangeException(nameof(weight), "A milestone weight must be between 0 and 100.");

        return new ObjectiveMilestone
        {
            TenantId = tenantId,
            Title = title.Trim(),
            Weight = weight,
            DueDate = dueDate,
        };
    }

    internal void AttachTo(Guid objectiveId) => ObjectiveId = objectiveId;

    /// <summary>Sets the milestone's completion (progress recording; reversible via a reopen).</summary>
    internal void SetCompleted(bool completed)
    {
        IsCompleted = completed;
        MarkUpdated();
    }
}
