namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

/// <summary>Configuration for the in-app deadline reminder sweep (bound from the "Reminders" section).</summary>
public sealed class ReminderOptions
{
    public const string SectionName = "Reminders";

    public bool Enabled { get; set; } = true;
    public int SweepIntervalMinutes { get; set; } = 60;
    public int DueSoonWindowDays { get; set; } = 3;

    /// <summary>How many days before a planned check-in the upcoming reminder fires.</summary>
    public int CheckInUpcomingWindowDays { get; set; } = 2;

    /// <summary>How many days before a follow-up action's due date the reminder fires.</summary>
    public int FollowUpActionDueWindowDays { get; set; } = 3;
}
