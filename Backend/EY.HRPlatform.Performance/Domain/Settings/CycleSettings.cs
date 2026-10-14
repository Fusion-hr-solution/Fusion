using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Objectives;

namespace EY.HRPlatform.Performance.Domain.Settings;

/// <summary>
/// The tenant's Performance Settings. Exactly one row per tenant. Planning and review defaults
/// are captured into a Cycle's activation snapshot; evidence retention is evaluated at access
/// and deletion time so changes also apply to already-closed Cycles.
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

    /// <summary>How an employee plan connects to strategic direction.</summary>
    public PlanAlignmentPolicy PlanAlignmentPolicy { get; private set; }

    public bool DefaultSelfAssessmentEnabled { get; private set; }
    public bool DefaultObjectiveRatingsEnabled { get; private set; }
    public bool DefaultCalibrationEnabled { get; private set; }

    /// <summary>Months uploaded evidence is retained after its Cycle closes.</summary>
    public int EvidenceRetentionMonths { get; private set; } = 36;

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
            PlanAlignmentPolicy = PlanAlignmentPolicy.AtLeastOneConnected,
            DefaultSelfAssessmentEnabled = true,
            DefaultObjectiveRatingsEnabled = true,
            DefaultCalibrationEnabled = false,
            EvidenceRetentionMonths = 36,
        };
    }

    public void Update(
        MeasurementMethod defaultMeasurementMethod,
        int suggestedObjectiveCountMin,
        int suggestedObjectiveCountMax,
        int planningDeadlineOffsetDays,
        PlanAlignmentPolicy planAlignmentPolicy,
        int? evidenceRetentionMonths = null,
        bool? defaultSelfAssessmentEnabled = null,
        bool? defaultObjectiveRatingsEnabled = null,
        bool? defaultCalibrationEnabled = null)
    {
        if (suggestedObjectiveCountMin < 1 || suggestedObjectiveCountMax < suggestedObjectiveCountMin || suggestedObjectiveCountMax > 20)
            throw new ArgumentException("The suggested objective-count range must be a sensible ascending range.", nameof(suggestedObjectiveCountMin));
        if (planningDeadlineOffsetDays is < 1 or > 365)
            throw new ArgumentOutOfRangeException(nameof(planningDeadlineOffsetDays), "The planning-deadline offset must be between 1 and 365 days.");

        if (!Enum.IsDefined(planAlignmentPolicy)) throw new ArgumentException("Choose a supported plan alignment policy.", nameof(planAlignmentPolicy));
        if (evidenceRetentionMonths is <= 0) throw new ArgumentOutOfRangeException(nameof(evidenceRetentionMonths), "Evidence retention must be at least one month.");

        DefaultMeasurementMethod = defaultMeasurementMethod;
        SuggestedObjectiveCountMin = suggestedObjectiveCountMin;
        SuggestedObjectiveCountMax = suggestedObjectiveCountMax;
        PlanningDeadlineOffsetDays = planningDeadlineOffsetDays;
        PlanAlignmentPolicy = planAlignmentPolicy;
        if (evidenceRetentionMonths is not null) EvidenceRetentionMonths = evidenceRetentionMonths.Value;
        if (defaultSelfAssessmentEnabled is not null) DefaultSelfAssessmentEnabled = defaultSelfAssessmentEnabled.Value;
        if (defaultObjectiveRatingsEnabled is not null) DefaultObjectiveRatingsEnabled = defaultObjectiveRatingsEnabled.Value;
        if (defaultCalibrationEnabled is not null) DefaultCalibrationEnabled = defaultCalibrationEnabled.Value;
        MarkUpdated();
    }

    /// <summary>A frozen, serializable copy of the effective settings for an activation snapshot.</summary>
    public CycleSettingsSnapshot ToSnapshot()
        => new(
            DefaultMeasurementMethod,
            SuggestedObjectiveCountMin,
            SuggestedObjectiveCountMax,
            PlanningDeadlineOffsetDays,
            PlanAlignmentPolicy);
}

/// <summary>Immutable capture of the Cycle-related settings effective at activation.</summary>
public sealed record CycleSettingsSnapshot(
    MeasurementMethod DefaultMeasurementMethod,
    int SuggestedObjectiveCountMin,
    int SuggestedObjectiveCountMax,
    int PlanningDeadlineOffsetDays,
    PlanAlignmentPolicy PlanAlignmentPolicy);
