using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>One milestone completed or reopened within a progress check-in.</summary>
public sealed class ProgressMilestoneChange : PerformanceChildEntity
{
    private ProgressMilestoneChange() { }

    public Guid ProgressUpdateId { get; private set; }
    public Guid MilestoneId { get; private set; }
    public bool Completed { get; private set; }

    internal static ProgressMilestoneChange Create(Guid tenantId, Guid milestoneId, bool completed)
        => new() { TenantId = tenantId, MilestoneId = milestoneId, Completed = completed };

    internal void AttachTo(Guid progressUpdateId) => ProgressUpdateId = progressUpdateId;
}
