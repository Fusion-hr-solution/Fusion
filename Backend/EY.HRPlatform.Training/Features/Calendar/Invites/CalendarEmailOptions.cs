namespace EY.HRPlatform.Training.Features.Calendar.Invites;

/// <summary>SMTP options for sending iMIP session invites (bound from <c>Email:Calendar</c>).</summary>
public sealed class CalendarEmailOptions
{
    public const string SectionName = "Email:Calendar";

    public bool Enabled { get; set; }
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 2525;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool UseSsl { get; set; }

    /// <summary>From address — also the iCalendar ORGANIZER (must match, or clients flag spoofing).</summary>
    public string FromEmail { get; set; } = "training.calendar@fusion.local";
    public string FromName { get; set; } = "EY Academy";
}
