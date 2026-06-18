using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// Transactional outbox row, enqueued in the SAME SaveChanges as the state change by the enrol /
/// cancel / reschedule / session-cancel handlers, and drained by CalendarBackgroundService through
/// ISessionInviteSync. <see cref="EmployeeId"/> is set for attendee-specific events and null for
/// session-wide ones (reschedule / session-cancel fan out to all confirmed attendees).
/// </summary>
public class CalendarSyncOutbox : BaseEntity
{
    public CalendarSyncType Type { get; private set; }
    public Guid SessionId { get; private set; }
    public Guid? EmployeeId { get; private set; }

    /// <summary>The session SEQUENCE this row was applied at — set once, so a retry never re-bumps.</summary>
    public int? AppliedSequence { get; private set; }

    public int Attempts { get; private set; }
    public DateTime NextAttemptUtc { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public string? LastError { get; private set; }

    // Claim lock so multiple service instances don't process the same row.
    public DateTime? LockedAt { get; private set; }
    public string? LockedBy { get; private set; }

    private CalendarSyncOutbox() { }

    public CalendarSyncOutbox(CalendarSyncType type, Guid sessionId, Guid? employeeId = null)
    {
        Type = type;
        SessionId = sessionId;
        EmployeeId = employeeId;
        NextAttemptUtc = DateTime.UtcNow;
    }

    public void RecordApplied(int sequence)
    {
        AppliedSequence = sequence;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkProcessed()
    {
        ProcessedAt = DateTime.UtcNow;
        LastError = null;
        LockedAt = null;
        LockedBy = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordFailure(string error, DateTime nextAttemptUtc)
    {
        Attempts++;
        LastError = error;
        NextAttemptUtc = nextAttemptUtc;
        LockedAt = null;
        LockedBy = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
