using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Objectives;

namespace EY.HRPlatform.Performance.Domain.Settings;

/// <summary>
/// The tenant's Performance Settings — limited to the Cycle &amp; Goals slice
/// (performance-cycle-settings). Holds stable tenant policy and strong defaults, never a
/// specific Cycle's business data. Exactly one row per tenant; its effective values are
/// captured into a Cycle's activation snapshot so later changes never rewrite a live Cycle.
/// </summary>
public sealed class CycleSettings : PerformanceAggregate
{
    private CycleSettings() { }

    /// <summary>Default measurement method offered when authoring a new objective.</summary>
    public MeasurementMethod DefaultMeasurementMethod { get; private set; }

    /// <summary>Advisory suggested objective-count range (guidance only, never a lock).</summary>
    public int SuggestedObjectiveCountMin { get; private set; }
    public int SuggestedObjectiveCountMax { get; private set; }

    /// <summary>Default planning-deadline offset, in days after a Cycle's start date.</summary>
    public int PlanningDeadlineOffsetDays { get; private set; }

    /// <summary>Whether additional standalone employee objectives are allowed (default On).</summary>
    public bool AllowStandaloneObjectives { get; private set; }

    /// <summary>The tenant defaults, materialized the first time Settings is read.</summary>
    public static CycleSettings CreateDefault(Guid tenantId)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));

        return new CycleSettings
        {
            TenantId = tenantId,
            DefaultMeasurementMethod = MeasurementMethod.NumericTarget,
            SuggestedObjectiveCountMin = 3,
            SuggestedObjectiveCountMax = 6,
            PlanningDeadlineOffsetDays = 30,
            AllowStandaloneObjectives = true,
        };
    }

    public void Update(
        MeasurementMethod defaultMeasurementMethod,
        int suggestedObjectiveCountMin,
        int suggestedObjectiveCountMax,
        int planningDeadlineOffsetDays,
        bool allowStandaloneObjectives)
    {
        if (suggestedObjectiveCountMin < 1 || suggestedObjectiveCountMax < suggestedObjectiveCountMin || suggestedObjectiveCountMax > 20)
            throw new ArgumentException("The suggested objective-count range must be a sensible ascending range.", nameof(suggestedObjectiveCountMin));
        if (planningDeadlineOffsetDays is < 1 or > 365)
            throw new ArgumentOutOfRangeException(nameof(planningDeadlineOffsetDays), "The planning-deadline offset must be between 1 and 365 days.");

        DefaultMeasurementMethod = defaultMeasurementMethod;
        SuggestedObjectiveCountMin = suggestedObjectiveCountMin;
        SuggestedObjectiveCountMax = suggestedObjectiveCountMax;
        PlanningDeadlineOffsetDays = planningDeadlineOffsetDays;
        AllowStandaloneObjectives = allowStandaloneObjectives;
        MarkUpdated();
    }

    /// <summary>A frozen, serializable copy of the effective settings for an activation snapshot.</summary>
    public CycleSettingsSnapshot ToSnapshot()
        => new(
            DefaultMeasurementMethod,
            SuggestedObjectiveCountMin,
            SuggestedObjectiveCountMax,
            PlanningDeadlineOffsetDays,
            AllowStandaloneObjectives);
}

/// <summary>Immutable capture of the Cycle-related settings effective at activation.</summary>
public sealed record CycleSettingsSnapshot(
    MeasurementMethod DefaultMeasurementMethod,
    int SuggestedObjectiveCountMin,
    int SuggestedObjectiveCountMax,
    int PlanningDeadlineOffsetDays,
    bool AllowStandaloneObjectives);
