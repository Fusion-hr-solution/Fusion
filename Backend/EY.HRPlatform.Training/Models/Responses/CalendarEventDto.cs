namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// One entry on a learner's calendar — either a timed <c>session</c> (from an enrollment) or an
/// all-day <c>deadline</c> marker (from a training assignment's due date).
/// </summary>
public class CalendarEventDto
{
    /// <summary>Session id for a session event; assignment id for a deadline marker.</summary>
    public Guid Id { get; set; }

    /// <summary>"session" or "deadline".</summary>
    public string Kind { get; set; } = "session";

    public string Title { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public bool AllDay { get; set; }

    public Guid TrainingId { get; set; }
    public Guid? PartId { get; set; }

    public string? Room { get; set; }
    public string? TrainerName { get; set; }

    /// <summary>Effective session status (Planned/InProgress/Completed). Null for deadline markers.</summary>
    public string? SessionStatus { get; set; }

    /// <summary>Enrolled / Waitlisted / Attended. Null for deadline markers.</summary>
    public string? EnrollmentStatus { get; set; }

    /// <summary>True when the learner is only waitlisted — rendered muted in-app.</summary>
    public bool IsWaitlisted { get; set; }
}
