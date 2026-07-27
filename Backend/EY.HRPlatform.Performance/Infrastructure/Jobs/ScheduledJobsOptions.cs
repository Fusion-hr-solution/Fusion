namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Configuration for the background job runner (bound from the "ScheduledJobs" section).
/// Mirrors <see cref="Notifications.ReminderOptions"/>; the reminder cadence itself still comes from
/// <c>ReminderOptions</c> so the existing deadline behaviour is unchanged.
/// </summary>
public sealed class ScheduledJobsOptions
{
    public const string SectionName = "ScheduledJobs";

    /// <summary>Master switch for the runner. When false, no jobs execute.</summary>
    public bool Enabled { get; set; } = true;

    public int InactivitySweepIntervalMinutes { get; set; } = 720;

    /// <summary>Days a participant's plan may remain unsubmitted after cycle open before a nudge.</summary>
    public int InactivityThresholdDays { get; set; } = 7;

    public int AttachmentCleanupIntervalMinutes { get; set; } = 360;

    /// <summary>Hours a pending (uncommitted) attachment may live before cleanup reaps it.</summary>
    public int AttachmentAbandonmentHours { get; set; } = 24;

    /// <summary>
    /// How often to look for campaigns that should have closed automatically but did not. A backstop
    /// behind the inline close path, so it runs infrequently by design.
    /// </summary>
    public int CampaignClosureReconciliationIntervalMinutes { get; set; } = 180;
}
