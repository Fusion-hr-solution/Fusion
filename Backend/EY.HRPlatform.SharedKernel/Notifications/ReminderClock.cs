namespace EY.HRPlatform.SharedKernel.Notifications;

/// <summary>
/// When reminders go out: from 09:00 in the company's time zone, Monday to Friday. A reminder that would fall on a
/// Saturday or Sunday goes out the Friday before, while there's still a working day to act on it.
/// </summary>
public static class ReminderClock
{
    public const int SendHour = 9;

    /// <summary>The company's working day to send on, or null before 09:00 local and at weekends.</summary>
    public static DateOnly? SendDay(DateTime utcNow, string? timeZoneId)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), Zone(timeZoneId));
        if (local.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday || local.Hour < SendHour) return null;
        return DateOnly.FromDateTime(local);
    }

    /// <summary>The reminder days a send day covers: itself, and on a Friday the weekend after it.</summary>
    public static IReadOnlyList<DateOnly> CoveredDays(DateOnly sendDay)
        => sendDay.DayOfWeek == DayOfWeek.Friday ? [sendDay, sendDay.AddDays(1), sendDay.AddDays(2)] : [sendDay];

    /// <summary>The company's zone; an unknown or missing id reads as UTC rather than stopping reminders.</summary>
    public static TimeZoneInfo Zone(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
    }
}
