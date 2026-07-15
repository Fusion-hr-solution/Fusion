namespace EY.HRPlatform.Training.Domain.Enums;

/// <summary>The kind of calendar change an outbox row represents.</summary>
public enum CalendarSyncType
{
    /// <summary>A learner became a confirmed attendee → send REQUEST to them.</summary>
    AttendeeAdded,

    /// <summary>A learner left the session → send CANCEL to them.</summary>
    AttendeeRemoved,

    /// <summary>The session moved/changed → send REQUEST (higher SEQUENCE) to all attendees.</summary>
    SessionRescheduled,

    /// <summary>The session was cancelled → send CANCEL to all attendees.</summary>
    SessionCancelled,

    /// <summary>A waitlisted learner was promoted → treated as AttendeeAdded.</summary>
    WaitlistPromoted,
}
