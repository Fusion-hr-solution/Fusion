using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Conversations;

public enum OneOnOneCadence { Weekly = 0, EveryTwoWeeks = 1, Monthly = 2 }
public enum OneOnOneEndReason { ReportingLineEnded = 0, PersonInactive = 1 }
public enum OneOnOneMeetingState { Upcoming = 0, Completed = 1, NotHeld = 2 }

/// <summary>Where a suggested agenda item came from; the item keeps a link to it.</summary>
public enum AgendaSourceKind { Objective = 0, UpdateRequest = 1, Feedback = 2, Praise = 3 }

/// <summary>Cadence arithmetic: steps keep the weekday and time of day.</summary>
public static class OneOnOneSchedule
{
    public static readonly TimeSpan MaxPast = TimeSpan.FromHours(24);
    public static readonly TimeSpan MaxAhead = TimeSpan.FromDays(365);

    public static DateTime Step(DateTime from, OneOnOneCadence cadence) => cadence switch
    {
        OneOnOneCadence.Weekly => from.AddDays(7),
        OneOnOneCadence.EveryTwoWeeks => from.AddDays(14),
        OneOnOneCadence.Monthly => from.AddMonths(1),
        _ => throw new ArgumentOutOfRangeException(nameof(cadence)),
    };

    /// <summary>The first cadence step after <paramref name="scheduledAt"/> that lies in the future.</summary>
    public static DateTime NextAfter(DateTime scheduledAt, OneOnOneCadence cadence, DateTime now)
    {
        var next = Step(scheduledAt, cadence);
        while (next <= now) next = Step(next, cadence);
        return next;
    }

    public static void EnsureInRange(DateTime at, DateTime now)
    {
        if (at < now - MaxPast) throw new ArgumentException("Choose a time no more than a day in the past.", nameof(at));
        if (at > now + MaxAhead) throw new ArgumentException("Choose a time within the next year.", nameof(at));
    }

    public static DateTime Utc(DateTime at) => at.Kind switch
    {
        DateTimeKind.Utc => at,
        DateTimeKind.Local => at.ToUniversalTime(),
        _ => DateTime.SpecifyKind(at, DateTimeKind.Utc),
    };
}

/// <summary>
/// The recurring conversation between a manager and one direct report (D-12). Only the two people ever see it.
/// It holds the cadence and the action items, which outlive meetings: an open item shows on every later meeting
/// until done. The reporting line is Core HR's; the series ends when Core no longer reports it, and never
/// reactivates. Meetings are their own aggregate so the two people's edits don't collide.
/// </summary>
public sealed class OneOnOneSeries : PerformanceAggregate
{
    public const int MaxOpenActions = 50;

    private readonly List<OneOnOneActionItem> _actions = [];

    private OneOnOneSeries() { }

    public Guid ManagerEmployeeId { get; private set; }
    /// <summary>Names as Core HR gave them when the series started; reads prefer Core's current names.</summary>
    public string ManagerName { get; private set; } = string.Empty;
    public Guid ReportEmployeeId { get; private set; }
    public string ReportName { get; private set; } = string.Empty;
    public OneOnOneCadence Cadence { get; private set; }
    public Guid StartedByEmployeeId { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? EndedAt { get; private set; }
    public OneOnOneEndReason? EndReason { get; private set; }

    public IReadOnlyList<OneOnOneActionItem> Actions => _actions;
    public bool IsActive => EndedAt is null;

    public bool Involves(Guid employeeId) => employeeId != Guid.Empty && (employeeId == ManagerEmployeeId || employeeId == ReportEmployeeId);
    public Guid OtherThan(Guid employeeId) => employeeId == ManagerEmployeeId ? ReportEmployeeId : ManagerEmployeeId;

    /// <summary>Starts a series with its first upcoming meeting.</summary>
    public static (OneOnOneSeries Series, OneOnOneMeeting FirstMeeting) Start(Guid tenantId, Guid managerEmployeeId, Guid reportEmployeeId,
        OneOnOneCadence cadence, Guid startedByEmployeeId, DateTime firstMeetingAt, DateTime now,
        string managerName = "", string reportName = "")
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (managerEmployeeId == Guid.Empty || reportEmployeeId == Guid.Empty || managerEmployeeId == reportEmployeeId)
            throw new ArgumentException("A 1:1 joins a manager and one direct report.", nameof(reportEmployeeId));
        if (!Enum.IsDefined(cadence)) throw new ArgumentException("Choose weekly, every two weeks or monthly.", nameof(cadence));
        if (startedByEmployeeId != managerEmployeeId && startedByEmployeeId != reportEmployeeId)
            throw new ArgumentException("Only the manager or the report starts their 1:1s.", nameof(startedByEmployeeId));
        var at = OneOnOneSchedule.Utc(firstMeetingAt);
        OneOnOneSchedule.EnsureInRange(at, now);

        var series = new OneOnOneSeries
        {
            TenantId = tenantId,
            ManagerEmployeeId = managerEmployeeId,
            ManagerName = managerName,
            ReportEmployeeId = reportEmployeeId,
            ReportName = reportName,
            Cadence = cadence,
            StartedByEmployeeId = startedByEmployeeId,
            StartedAt = now,
        };
        return (series, OneOnOneMeeting.Schedule(series, at));
    }

    public bool ChangeCadence(OneOnOneCadence cadence)
    {
        EnsureActive();
        if (!Enum.IsDefined(cadence)) throw new ArgumentException("Choose weekly, every two weeks or monthly.", nameof(cadence));
        if (Cadence == cadence) return false;
        Cadence = cadence;
        MarkUpdated();
        return true;
    }

    /// <summary>Ends the series for good. False when it had already ended.</summary>
    public bool End(OneOnOneEndReason reason, DateTime now)
    {
        if (EndedAt is not null) return false;
        EndedAt = now;
        EndReason = reason;
        MarkUpdated();
        return true;
    }

    /// <summary>Adds an action item; a retry with the same id returns the existing one unchanged.</summary>
    public OneOnOneActionItem AddAction(Guid actionId, string text, Guid ownerEmployeeId, DateOnly? dueDate, Guid meetingId, Guid actorEmployeeId,
        out bool added)
    {
        EnsureActive();
        var existing = _actions.FirstOrDefault(a => a.Id == actionId);
        if (existing is not null) { added = false; return existing; }
        if (actionId == Guid.Empty) throw new ArgumentException("An action item needs an id.", nameof(actionId));
        if (!Involves(ownerEmployeeId)) throw new ArgumentException("An action item belongs to one of the two people.", nameof(ownerEmployeeId));
        EnsureRoomForOpenAction();
        var item = OneOnOneActionItem.Create(TenantId, actionId, Id, text, ownerEmployeeId, dueDate, meetingId, actorEmployeeId);
        _actions.Add(item);
        MarkUpdated();
        added = true;
        return item;
    }

    public OneOnOneActionItem EditAction(Guid actionId, string text, Guid ownerEmployeeId, DateOnly? dueDate)
    {
        EnsureActive();
        if (!Involves(ownerEmployeeId)) throw new ArgumentException("An action item belongs to one of the two people.", nameof(ownerEmployeeId));
        var item = FindAction(actionId);
        item.Edit(text, ownerEmployeeId, dueDate);
        MarkUpdated();
        return item;
    }

    /// <summary>Marks an item done in the given meeting, or reopens it. Setting the current value changes nothing.</summary>
    public bool SetActionDone(Guid actionId, bool done, Guid meetingId, DateTime now)
    {
        EnsureActive();
        var item = FindAction(actionId);
        if (!done && item.DoneAt is not null) EnsureRoomForOpenAction();
        var changed = item.SetDone(done, meetingId, now);
        if (changed) MarkUpdated();
        return changed;
    }

    public IReadOnlyList<OneOnOneActionItem> OpenActionItems() => _actions.Where(a => a.DoneAt is null).ToList();

    private void EnsureRoomForOpenAction()
    {
        if (_actions.Count(a => a.DoneAt is null) >= MaxOpenActions)
            throw new ArgumentException($"A 1:1 holds up to {MaxOpenActions} open action items. Mark some done first.");
    }

    private OneOnOneActionItem FindAction(Guid actionId)
        => _actions.FirstOrDefault(a => a.Id == actionId) ?? throw new KeyNotFoundException("That action item isn't part of this 1:1.");

    public void EnsureActive()
    {
        if (EndedAt is not null) throw new InvalidOperationException("This 1:1 series has ended.");
    }
}

/// <summary>Something one of the two people agreed to do. It carries over until done.</summary>
public sealed class OneOnOneActionItem : PerformanceChildEntity
{
    public const int MaxTextLength = 200;

    private OneOnOneActionItem() { }

    public Guid SeriesId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public Guid OwnerEmployeeId { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public Guid CreatedByEmployeeId { get; private set; }
    public Guid CreatedInMeetingId { get; private set; }
    public DateTime? DoneAt { get; private set; }
    public Guid? DoneInMeetingId { get; private set; }

    internal static OneOnOneActionItem Create(Guid tenantId, Guid id, Guid seriesId, string text, Guid ownerEmployeeId, DateOnly? dueDate,
        Guid meetingId, Guid actorEmployeeId)
    {
        var item = new OneOnOneActionItem
        {
            Id = id, TenantId = tenantId, SeriesId = seriesId, CreatedByEmployeeId = actorEmployeeId, CreatedInMeetingId = meetingId,
        };
        item.Edit(text, ownerEmployeeId, dueDate);
        return item;
    }

    internal void Edit(string text, Guid ownerEmployeeId, DateOnly? dueDate)
    {
        Text = OneOnOneText.Required(text, MaxTextLength, "an action item");
        OwnerEmployeeId = ownerEmployeeId;
        DueDate = dueDate;
        MarkUpdated();
    }

    internal bool SetDone(bool done, Guid meetingId, DateTime now)
    {
        if (done == (DoneAt is not null)) return false;
        DoneAt = done ? now : null;
        DoneInMeetingId = done ? meetingId : null;
        MarkUpdated();
        return true;
    }
}

/// <summary>
/// One meeting of a series: its time, agenda and shared notes. Private notes live beside it, in their own rows,
/// and are only ever read by their author. Completing it schedules the next one a cadence later.
/// </summary>
public sealed class OneOnOneMeeting : PerformanceAggregate
{
    public const int MaxNotesLength = 10_000;
    public const int MaxAgendaItems = 50;

    private readonly List<OneOnOneAgendaItem> _agenda = [];

    private OneOnOneMeeting() { }

    public Guid SeriesId { get; private set; }
    public DateTime ScheduledAt { get; private set; }
    public OneOnOneMeetingState State { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public Guid? CompletedByEmployeeId { get; private set; }
    /// <summary>The meeting completing this one created; set once, so a retried completion finds it.</summary>
    public Guid? NextMeetingId { get; private set; }
    public string SharedNotes { get; private set; } = string.Empty;
    /// <summary>Guards the shared note on its own, so an agenda change never conflicts with a notes save.</summary>
    public uint SharedNotesRevision { get; private set; }

    public IReadOnlyList<OneOnOneAgendaItem> Agenda => _agenda;

    internal static OneOnOneMeeting Schedule(OneOnOneSeries series, DateTime at)
        => new() { TenantId = series.TenantId, SeriesId = series.Id, ScheduledAt = at, State = OneOnOneMeetingState.Upcoming };

    public void Reschedule(DateTime at, DateTime now)
    {
        EnsureUpcoming();
        var utc = OneOnOneSchedule.Utc(at);
        OneOnOneSchedule.EnsureInRange(utc, now);
        ScheduledAt = utc;
        MarkUpdated();
    }

    /// <summary>Completes the meeting and schedules its successor, or returns null when it was already completed.</summary>
    public OneOnOneMeeting? Complete(OneOnOneSeries series, Guid actorEmployeeId, DateTime now)
    {
        if (State == OneOnOneMeetingState.Completed) return null;
        EnsureUpcoming();
        series.EnsureActive();
        var next = Schedule(series, OneOnOneSchedule.NextAfter(ScheduledAt, series.Cadence, now));
        State = OneOnOneMeetingState.Completed;
        CompletedAt = now;
        CompletedByEmployeeId = actorEmployeeId;
        NextMeetingId = next.Id;
        MarkUpdated();
        return next;
    }

    /// <summary>The series ended before this meeting was held.</summary>
    public void MarkNotHeld()
    {
        if (State != OneOnOneMeetingState.Upcoming) return;
        State = OneOnOneMeetingState.NotHeld;
        MarkUpdated();
    }

    /// <summary>Adds an item; a retry with the same id returns the existing one.</summary>
    public OneOnOneAgendaItem AddAgendaItem(Guid itemId, string text, Guid authorEmployeeId, AgendaSource? source, out bool added)
    {
        var existing = _agenda.FirstOrDefault(i => i.Id == itemId);
        if (existing is not null) { added = false; return existing; }
        EnsureUpcoming();
        if (itemId == Guid.Empty) throw new ArgumentException("An agenda item needs an id.", nameof(itemId));
        if (source is not null && _agenda.Any(i => i.SourceKind == source.Kind && i.SourceId == source.Id))
            throw new InvalidOperationException("That's already on the agenda.");
        if (_agenda.Count >= MaxAgendaItems) throw new ArgumentException($"An agenda holds up to {MaxAgendaItems} items.");
        var order = _agenda.Count == 0 ? 0 : _agenda.Max(i => i.Order) + 1;
        var item = OneOnOneAgendaItem.Create(TenantId, itemId, Id, text, authorEmployeeId, order, source);
        _agenda.Add(item);
        MarkUpdated();
        added = true;
        return item;
    }

    public bool SetDiscussed(Guid itemId, bool discussed, DateTime now)
    {
        EnsureUpcoming();
        var changed = FindItem(itemId).SetDiscussed(discussed, now);
        if (changed) MarkUpdated();
        return changed;
    }

    /// <summary>Removes the author's own item. False when it's already gone.</summary>
    public bool RemoveAgendaItem(Guid itemId, Guid actorEmployeeId)
    {
        var item = _agenda.FirstOrDefault(i => i.Id == itemId);
        if (item is null) return false;
        EnsureUpcoming();
        if (item.AuthorEmployeeId != actorEmployeeId) throw new UnauthorizedAccessException("Only the person who added an item removes it.");
        _agenda.Remove(item);
        MarkUpdated();
        return true;
    }

    /// <summary>Replaces the shared note when the caller saw its current revision.</summary>
    public bool SetSharedNotes(string text, uint expectedRevision, bool successorCompleted)
    {
        EnsureNotesWritable(successorCompleted);
        if (expectedRevision != SharedNotesRevision) throw new OneOnOneNotesConflictException();
        var value = OneOnOneText.Optional(text, MaxNotesLength, "notes");
        if (value == SharedNotes) return false;
        SharedNotes = value;
        SharedNotesRevision++;
        MarkUpdated();
        return true;
    }

    /// <summary>Notes are written while upcoming, and after completion until the next meeting is completed too.</summary>
    public void EnsureNotesWritable(bool successorCompleted)
    {
        var writable = State == OneOnOneMeetingState.Upcoming || (State == OneOnOneMeetingState.Completed && !successorCompleted);
        if (!writable) throw new InvalidOperationException("These notes are closed: the meeting after this one is completed.");
    }

    private OneOnOneAgendaItem FindItem(Guid itemId)
        => _agenda.FirstOrDefault(i => i.Id == itemId) ?? throw new KeyNotFoundException("That item isn't on this agenda.");

    private void EnsureUpcoming()
    {
        if (State != OneOnOneMeetingState.Upcoming) throw new InvalidOperationException("This meeting is no longer upcoming.");
    }
}

/// <summary>The source a suggested item links to, with a label that never carries feedback or praise text.</summary>
public sealed record AgendaSource(AgendaSourceKind Kind, Guid Id, Guid? CycleId);

public sealed class OneOnOneAgendaItem : PerformanceChildEntity
{
    public const int MaxTextLength = 200;

    private OneOnOneAgendaItem() { }

    public Guid MeetingId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public Guid AuthorEmployeeId { get; private set; }
    public int Order { get; private set; }
    public DateTime? DiscussedAt { get; private set; }
    public AgendaSourceKind? SourceKind { get; private set; }
    public Guid? SourceId { get; private set; }
    public Guid? SourceCycleId { get; private set; }

    internal static OneOnOneAgendaItem Create(Guid tenantId, Guid id, Guid meetingId, string text, Guid authorEmployeeId, int order, AgendaSource? source)
        => new()
        {
            Id = id, TenantId = tenantId, MeetingId = meetingId, AuthorEmployeeId = authorEmployeeId, Order = order,
            Text = OneOnOneText.Required(text, MaxTextLength, "an agenda item"),
            SourceKind = source?.Kind, SourceId = source?.Id, SourceCycleId = source?.CycleId,
        };

    internal bool SetDiscussed(bool discussed, DateTime now)
    {
        if (discussed == (DiscussedAt is not null)) return false;
        DiscussedAt = discussed ? now : null;
        MarkUpdated();
        return true;
    }
}

/// <summary>One person's own note on a meeting. Never returned to anyone but its author.</summary>
public sealed class OneOnOnePrivateNote : PerformanceChildEntity
{
    private OneOnOnePrivateNote() { }

    public Guid MeetingId { get; private set; }
    public Guid AuthorEmployeeId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public uint Revision { get; private set; }

    public static OneOnOnePrivateNote Create(Guid tenantId, Guid meetingId, Guid authorEmployeeId)
        => new() { TenantId = tenantId, MeetingId = meetingId, AuthorEmployeeId = authorEmployeeId };

    public bool Set(string text, uint expectedRevision)
    {
        if (expectedRevision != Revision) throw new OneOnOneNotesConflictException();
        var value = OneOnOneText.Optional(text, OneOnOneMeeting.MaxNotesLength, "notes");
        if (value == Text) return false;
        Text = value;
        Revision++;
        MarkUpdated();
        return true;
    }
}

/// <summary>A notes save from a revision someone else has since replaced.</summary>
public sealed class OneOnOneNotesConflictException() : Exception("These notes changed since you opened them.");

internal static class OneOnOneText
{
    public static string Required(string? text, int max, string what)
    {
        var value = text?.Trim() ?? string.Empty;
        if (value.Length == 0) throw new ArgumentException($"Write {what}.");
        if (value.Length > max) throw new ArgumentException($"Keep {what} to {max} characters.");
        return value;
    }

    public static string Optional(string? text, int max, string what)
    {
        var value = text ?? string.Empty;
        if (value.Length > max) throw new ArgumentException($"Keep {what} to {max:N0} characters.");
        return value;
    }
}
