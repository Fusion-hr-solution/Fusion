using Ical.Net;
using Ical.Net.CalendarComponents;
using Ical.Net.DataTypes;
using Ical.Net.Serialization;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Calendar.Ics;

/// <summary>Builds RFC 5545 iCalendar (VCALENDAR) text from calendar events using Ical.Net.</summary>
public interface ICalendarFeedService
{
    /// <summary>Serialize the events into a METHOD:PUBLISH VCALENDAR document.</summary>
    string Build(IReadOnlyCollection<CalendarEventDto> events, string calendarName);
}

public sealed class IcsCalendarFeed : ICalendarFeedService
{
    private const string ProdId = "-//EY Fusion//Training Calendar//EN";
    private const string UidDomain = "fusion-training";

    public string Build(IReadOnlyCollection<CalendarEventDto> events, string calendarName)
    {
        var calendar = new Ical.Net.Calendar
        {
            ProductId = ProdId,
            Method = "PUBLISH"
        };

        var stamp = new CalDateTime(DateTime.UtcNow, "UTC", true);

        foreach (var e in events)
        {
            var ev = new CalendarEvent
            {
                // Stable per (kind, id) so client refreshes update the event in place.
                Uid = $"{e.Kind}-{e.Id:D}@{UidDomain}",
                Summary = e.Title,
                Sequence = 0,
                Status = EventStatus.Confirmed,
                DtStamp = stamp
            };

            if (e.AllDay)
            {
                var date = DateOnly.FromDateTime(e.StartUtc);
                ev.Start = new CalDateTime(date);
                ev.End = new CalDateTime(date.AddDays(1));
            }
            else
            {
                // Stored UTC instants → DTSTART/DTEND in UTC ("...Z"); clients localize themselves.
                ev.Start = new CalDateTime(e.StartUtc, "UTC", true);
                ev.End = new CalDateTime(e.EndUtc, "UTC", true);
            }

            if (!string.IsNullOrWhiteSpace(e.Room))
                ev.Location = e.Room;

            if (!string.IsNullOrWhiteSpace(e.TrainerName))
                ev.Description = $"Trainer: {e.TrainerName}";

            calendar.Events.Add(ev);
        }

        return new CalendarSerializer().SerializeToString(calendar) ?? string.Empty;
    }
}
