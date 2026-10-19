namespace EY.HRPlatform.Performance.Domain.Reviews;

/// <summary>
/// When open review work is reminded (D-03): three days before the due date, the day after it, then weekly
/// while still open. An unacknowledged result is reminded on its reminder day after release, then weekly.
/// </summary>
public static class ReviewReminderSchedule
{
    public static bool IsTaskReminderDay(DateOnly due, DateOnly day)
    {
        if (day == due.AddDays(-3)) return true;
        var sinceFirstLate = day.DayNumber - due.AddDays(1).DayNumber;
        return sinceFirstLate >= 0 && sinceFirstLate % 7 == 0;
    }

    /// <summary>The first reminder day on or after <paramref name="from"/>.</summary>
    public static DateOnly NextTaskReminder(DateOnly due, DateOnly from)
    {
        if (from <= due.AddDays(-3)) return due.AddDays(-3);
        var firstLate = due.AddDays(1);
        if (from <= firstLate) return firstLate;
        var weeks = (from.DayNumber - firstLate.DayNumber + 6) / 7;
        return firstLate.AddDays(weeks * 7);
    }

    public static bool IsAcknowledgementReminderDay(DateOnly released, int reminderDays, DateOnly day)
    {
        var since = day.DayNumber - released.AddDays(reminderDays).DayNumber;
        return since >= 0 && since % 7 == 0;
    }

    public static DateOnly NextAcknowledgementReminder(DateOnly released, int reminderDays, DateOnly from)
    {
        var first = released.AddDays(reminderDays);
        if (from <= first) return first;
        var weeks = (from.DayNumber - first.DayNumber + 6) / 7;
        return first.AddDays(weeks * 7);
    }

    /// <summary>Whole days past the due date; zero when not late.</summary>
    public static int DaysLate(DateOnly? due, DateOnly today) => due is DateOnly date && today > date ? today.DayNumber - date.DayNumber : 0;
}
