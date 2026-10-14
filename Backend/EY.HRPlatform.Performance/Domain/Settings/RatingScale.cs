using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Settings;

public sealed record RatingScaleLevel(int Value, string Label, string? Description);

/// <summary>The tenant's pointer to its current immutable rating vocabulary.</summary>
public sealed class RatingScale : PerformanceAggregate
{
    private RatingScale() { }

    public Guid? CurrentVersionId { get; private set; }
    public int CurrentVersionNumber { get; private set; }

    public static RatingScale CreateDefault(Guid tenantId)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        return new RatingScale { TenantId = tenantId };
    }

    public RatingScaleVersion CreateNextVersion(IReadOnlyList<RatingScaleLevel> levels)
    {
        var next = RatingScaleVersion.Create(TenantId, Id, CurrentVersionNumber + 1, levels);
        CurrentVersionId = next.Id;
        CurrentVersionNumber = next.Number;
        MarkUpdated();
        return next;
    }
}
