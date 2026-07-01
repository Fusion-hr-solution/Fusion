using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.Cycles;

/// <summary>
/// Derived deadline state for a cycle's objective-setting deadline, computed on read.
/// Reminder delivery materialises notifications from the same states (see the deadline worker).
/// </summary>
public static class CycleDeadline
{
    public const string None = "None";
    public const string Upcoming = "Upcoming";
    public const string DueSoon = "DueSoon";
    public const string Overdue = "Overdue";

    public static string Evaluate(PerformanceCycle cycle, DateTime utcNow, int dueSoonWindowDays)
        => Evaluate(cycle.ObjectiveSettingDeadline, cycle.Status, utcNow, dueSoonWindowDays);

    public static string Evaluate(
        DateTime? objectiveSettingDeadline,
        PerformanceCycleStatus status,
        DateTime utcNow,
        int dueSoonWindowDays)
    {
        // Deadlines only matter while a cycle is in flight.
        if (objectiveSettingDeadline is null
            || status is PerformanceCycleStatus.Draft or PerformanceCycleStatus.Closed)
        {
            return None;
        }

        var deadline = objectiveSettingDeadline.Value;
        if (deadline < utcNow)
        {
            return Overdue;
        }

        return deadline <= utcNow.AddDays(Math.Max(0, dueSoonWindowDays))
            ? DueSoon
            : Upcoming;
    }
}
