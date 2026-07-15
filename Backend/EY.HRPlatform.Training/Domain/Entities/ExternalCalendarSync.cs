using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// Canonical calendar-event identity for a Session — the stable iCalendar UID and the monotonic
/// SEQUENCE that drives iMIP REQUEST/CANCEL updates. Provider-neutral: the Graph-only fields stay
/// null under the default iMIP provider.
/// </summary>
public class ExternalCalendarSync : BaseEntity
{
    public Guid SessionId { get; private set; }
    public string ICalUid { get; private set; } = string.Empty;
    public int Sequence { get; private set; }
    public CalendarSyncStatus Status { get; private set; } = CalendarSyncStatus.Active;
    public CalendarProvider Provider { get; private set; } = CalendarProvider.Imip;
    public string? LastError { get; private set; }

    // Graph-only — null under iMIP.
    public string? GraphEventId { get; private set; }
    public string? ChangeKey { get; private set; }
    public string? TeamsJoinUrl { get; private set; }
    public string? OutlookWebLink { get; private set; }

    private ExternalCalendarSync() { }

    public ExternalCalendarSync(Guid sessionId, string iCalUid, CalendarProvider provider)
    {
        SessionId = sessionId;
        ICalUid = iCalUid;
        Provider = provider;
    }

    /// <summary>Advance the canonical SEQUENCE (on reschedule or cancellation) and return the new value.</summary>
    public int BumpSequence()
    {
        Sequence++;
        UpdatedAt = DateTime.UtcNow;
        return Sequence;
    }

    public void MarkCancelled()
    {
        Status = CalendarSyncStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetError(string? error)
    {
        LastError = error;
        UpdatedAt = DateTime.UtcNow;
    }
}
