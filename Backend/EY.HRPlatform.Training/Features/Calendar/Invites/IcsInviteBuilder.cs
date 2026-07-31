using Ical.Net;
using Ical.Net.CalendarComponents;
using Ical.Net.DataTypes;
using Ical.Net.Serialization;
using EY.HRPlatform.Training.Domain.Enums;

namespace EY.HRPlatform.Training.Features.Calendar.Invites;

/// <summary>Builds an iMIP VCALENDAR (METHOD:REQUEST / CANCEL) for a single attendee, via Ical.Net.</summary>
public sealed class IcsInviteBuilder
{
    private const string ProdId = "-//EY Fusion//Training Calendar//EN";

    public string Build(SessionInviteMessage m)
    {
        var isCancel = m.Method == InviteMethod.Cancel;

        var calendar = new Ical.Net.Calendar
        {
            ProductId = ProdId,
            Method = isCancel ? "CANCEL" : "REQUEST",
        };

        var ev = new CalendarEvent
        {
            Uid = m.ICalUid,
            Sequence = m.Sequence,
            Summary = m.Title,
            Start = new CalDateTime(m.StartUtc, "UTC", true),
            End = new CalDateTime(m.EndUtc, "UTC", true),
            DtStamp = new CalDateTime(DateTime.UtcNow, "UTC", true),
            Status = isCancel ? EventStatus.Cancelled : EventStatus.Confirmed,
            Organizer = new Organizer($"mailto:{m.OrganizerEmail}") { CommonName = m.OrganizerName },
        };

        if (!string.IsNullOrWhiteSpace(m.Location)) ev.Location = m.Location;
        if (!string.IsNullOrWhiteSpace(m.Description)) ev.Description = m.Description;

        ev.Attendees.Add(new Attendee($"mailto:{m.Recipient.Email}")
        {
            CommonName = m.Recipient.Name,
            Rsvp = true,
            ParticipationStatus = "NEEDS-ACTION",
        });

        calendar.Events.Add(ev);
        return new CalendarSerializer().SerializeToString(calendar) ?? string.Empty;
    }
}
