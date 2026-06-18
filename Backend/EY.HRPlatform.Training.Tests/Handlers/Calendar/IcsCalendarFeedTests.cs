using EY.HRPlatform.Training.Features.Calendar.Ics;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class IcsCalendarFeedTests
{
    private static CalendarEventDto Session(Guid id, DateTime start, DateTime end)
        => new()
        {
            Id = id,
            Kind = "session",
            Title = "C# — Day 1",
            StartUtc = start,
            EndUtc = end,
            AllDay = false,
            Room = "A101",
            TrainerName = "Jane"
        };

    [Fact]
    public void Build_ProducesParseableVcalendar_WithUtcTimesAndStableUid()
    {
        var feed = new IcsCalendarFeed();
        var id = Guid.NewGuid();
        var start = new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc);

        var ics = feed.Build(new[] { Session(id, start, end) }, "EY Academy");

        Assert.Contains("BEGIN:VCALENDAR", ics);
        Assert.Contains("METHOD:PUBLISH", ics);
        Assert.Contains($"session-{id:D}@fusion-training", ics);
        Assert.Contains("20260710T090000Z", ics); // DTSTART in UTC

        var parsed = Ical.Net.Calendar.Load(ics)!;
        var ev = Assert.Single(parsed.Events);
        Assert.Equal($"session-{id:D}@fusion-training", ev.Uid);
        Assert.Equal("A101", ev.Location);

        // UID is stable across rebuilds → calendar clients update in place rather than duplicate.
        var ics2 = feed.Build(new[] { Session(id, start, end) }, "EY Academy");
        Assert.Contains($"session-{id:D}@fusion-training", ics2);
    }

    [Fact]
    public void Build_AllDayDeadline_UsesDateValueType()
    {
        var feed = new IcsCalendarFeed();
        var due = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc);
        var ev = new CalendarEventDto
        {
            Id = Guid.NewGuid(),
            Kind = "deadline",
            Title = "Due: C#",
            StartUtc = due,
            EndUtc = due,
            AllDay = true
        };

        var ics = feed.Build(new[] { ev }, "EY Academy");

        Assert.Contains("VALUE=DATE", ics);
        Assert.Contains("20260720", ics);
        Assert.Single(Ical.Net.Calendar.Load(ics)!.Events);
    }
}
