using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Objectives;

/// <summary>
/// A configured contribution of one direct child objective to a calculated organizational
/// parent, carrying exactly one contribution weight (product-spec §21). Not every aligned child
/// is a contributor — a contribution link is created deliberately, distinct from alignment. The
/// configured links' weights must total 100% before the calculation baseline locks.
/// </summary>
public sealed class ContributionLink : PerformanceChildEntity
{
    private ContributionLink() { }

    /// <summary>The calculated parent objective this link contributes to.</summary>
    public Guid ObjectiveId { get; private set; }

    /// <summary>The direct child objective that mathematically contributes.</summary>
    public Guid ChildObjectiveId { get; private set; }

    public decimal Weight { get; private set; }

    public static ContributionLink Create(Guid tenantId, Guid childObjectiveId, decimal weight)
    {
        if (childObjectiveId == Guid.Empty)
            throw new ArgumentException("A contribution link requires a child objective.", nameof(childObjectiveId));
        if (weight <= 0m || weight > 100m)
            throw new ArgumentOutOfRangeException(nameof(weight), "A contribution weight must be between 0 and 100.");

        return new ContributionLink
        {
            TenantId = tenantId,
            ChildObjectiveId = childObjectiveId,
            Weight = weight,
        };
    }

    internal void AttachTo(Guid objectiveId) => ObjectiveId = objectiveId;
}
