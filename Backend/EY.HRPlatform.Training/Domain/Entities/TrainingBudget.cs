using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// A budget allocated to a service line for a non-overlapping date range. Spend, remaining and
/// percent-consumed are never stored here — they are derived at read time from external-session
/// costs. Non-overlap per service line is enforced in the command handlers.
/// </summary>
public class TrainingBudget : BaseEntity
{
    // Soft reference (no FK) — a budget is configuration that can outlive a service line.
    public Guid ServiceLineId { get; private set; }
    public PeriodType PeriodType { get; private set; }
    public DateTime PeriodStart { get; private set; }
    public DateTime PeriodEnd { get; private set; }
    public decimal AllocatedAmount { get; private set; }

    private TrainingBudget() { }

    public TrainingBudget(
        Guid serviceLineId,
        PeriodType periodType,
        DateTime periodStart,
        DateTime periodEnd,
        decimal allocatedAmount)
    {
        ServiceLineId = serviceLineId;
        PeriodType = periodType;
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        AllocatedAmount = allocatedAmount;
    }

    /// <summary>Service line is immutable (re-keying = delete + create) to keep overlap logic simple.</summary>
    public void Update(
        PeriodType periodType,
        DateTime periodStart,
        DateTime periodEnd,
        decimal allocatedAmount)
    {
        PeriodType = periodType;
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        AllocatedAmount = allocatedAmount;
        UpdatedAt = DateTime.UtcNow;
    }
}
