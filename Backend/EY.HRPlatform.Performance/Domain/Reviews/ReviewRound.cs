using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Cycles;

namespace EY.HRPlatform.Performance.Domain.Reviews;

/// <summary>A configured review episode within one Cycle; launch freezes its effective configuration.</summary>
public sealed class ReviewRound : PerformanceAggregate
{
    private ReviewRound() { }

    public Guid CycleId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public DateOnly PeriodStart { get; private set; }
    public DateOnly PeriodEnd { get; private set; }
    public bool SelfAssessmentEnabled { get; private set; }
    public bool ObjectiveRatingsEnabled { get; private set; }
    public bool CalibrationEnabled { get; private set; }
    public DateOnly? SelfAssessmentDueDate { get; private set; }
    public DateOnly? ManagerAssessmentDueDate { get; private set; }
    public string CompetencyIdsJson { get; private set; } = "[]";
    public string? ConfigSnapshotJson { get; private set; }
    public Guid? RatingScaleVersionId { get; private set; }
    public DateTime? LaunchedAt { get; private set; }
    public ReviewRoundState State { get; private set; }

    /// <summary>Non-null only while Active; a filtered unique index enforces one Active round per Cycle.</summary>
    public Guid? ActiveCycleSlot { get; private set; }

    public static ReviewRound CreateDraft(Guid tenantId, PerformanceCycle cycle, string name,
        DateOnly periodStart, DateOnly periodEnd, bool selfAssessmentEnabled,
        bool objectiveRatingsEnabled, bool calibrationEnabled)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        if (cycle.State != CycleLifecycleState.Active)
            throw new InvalidOperationException("Review rounds can only be created in an Active Cycle.");
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("A round requires a name.", nameof(name));
        ValidatePeriod(cycle, periodStart, periodEnd);
        return new ReviewRound
        {
            TenantId = tenantId,
            CycleId = cycle.Id,
            Name = name.Trim(),
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            SelfAssessmentEnabled = selfAssessmentEnabled,
            ObjectiveRatingsEnabled = objectiveRatingsEnabled,
            CalibrationEnabled = calibrationEnabled,
            State = ReviewRoundState.Draft,
        };
    }

    public void UpdateDraft(PerformanceCycle cycle, string name, DateOnly periodStart, DateOnly periodEnd,
        bool selfAssessmentEnabled, bool objectiveRatingsEnabled, bool calibrationEnabled,
        DateOnly? selfAssessmentDueDate, DateOnly? managerAssessmentDueDate, string competencyIdsJson)
    {
        RequireDraft();
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("A round requires a name.", nameof(name));
        ValidatePeriod(cycle, periodStart, periodEnd);
        if (selfAssessmentDueDate is not null && selfAssessmentDueDate < periodStart)
            throw new ArgumentException("The self-assessment due date must be on or after the review period starts.", nameof(selfAssessmentDueDate));
        if (managerAssessmentDueDate is not null && managerAssessmentDueDate < periodStart)
            throw new ArgumentException("The manager-assessment due date must be on or after the review period starts.", nameof(managerAssessmentDueDate));
        Name = name.Trim();
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        SelfAssessmentEnabled = selfAssessmentEnabled;
        ObjectiveRatingsEnabled = objectiveRatingsEnabled;
        CalibrationEnabled = calibrationEnabled;
        SelfAssessmentDueDate = selfAssessmentDueDate;
        ManagerAssessmentDueDate = managerAssessmentDueDate;
        CompetencyIdsJson = competencyIdsJson;
        MarkUpdated();
    }

    public void Launch(string configSnapshotJson, Guid ratingScaleVersionId, DateTime launchedAt)
    {
        RequireDraft();
        if (string.IsNullOrWhiteSpace(configSnapshotJson)) throw new ArgumentException("A configuration snapshot is required.", nameof(configSnapshotJson));
        if (ratingScaleVersionId == Guid.Empty) throw new ArgumentException("A rating-scale version is required.", nameof(ratingScaleVersionId));
        ConfigSnapshotJson = configSnapshotJson;
        RatingScaleVersionId = ratingScaleVersionId;
        LaunchedAt = launchedAt;
        State = ReviewRoundState.Active;
        ActiveCycleSlot = CycleId;
        MarkUpdated();
    }

    public void Close()
    {
        if (State != ReviewRoundState.Active) throw new InvalidOperationException("Only an Active review round can close.");
        State = ReviewRoundState.Closed;
        ActiveCycleSlot = null;
        MarkUpdated();
    }

    private void RequireDraft()
    {
        if (State != ReviewRoundState.Draft) throw new InvalidOperationException("Only a Draft review round can be configured.");
    }

    private static void ValidatePeriod(PerformanceCycle cycle, DateOnly start, DateOnly end)
    {
        if (end < start || start < cycle.StartDate || end > cycle.EndDate)
            throw new ArgumentException("The review period must lie within the Cycle dates.");
    }
}
