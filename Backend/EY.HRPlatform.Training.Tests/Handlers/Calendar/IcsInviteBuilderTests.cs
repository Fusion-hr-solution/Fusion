using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Invites;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class IcsInviteBuilderTests
{
    private static SessionInviteMessage Msg(InviteMethod method, int seq) => new(
        "session-abc@fusion-training", seq, method,
        new SessionInviteRecipient(Guid.NewGuid(), "learner@x.com", "Lee Learner"),
        "training.calendar@ey", "EY Academy",
        "C# — Day 1",
        new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
        new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc),
        "Room A101", "Trainer: Jane");

    [Fact]
    public void Build_Request_HasMethodRequest_Organizer_Attendee_Confirmed_Utc()
    {
        var ics = new IcsInviteBuilder().Build(Msg(InviteMethod.Request, 0));
        var flat = ics.Replace("\r\n ", string.Empty); // unfold RFC 5545 line folding

        Assert.Contains("METHOD:REQUEST", flat);
        Assert.Contains("UID:session-abc@fusion-training", flat);
        Assert.Contains("SEQUENCE:0", flat);
        Assert.Contains("ORGANIZER", flat);
        Assert.Contains("training.calendar@ey", flat);
        Assert.Contains("ATTENDEE", flat);
        Assert.Contains("learner@x.com", flat);
        Assert.Contains("20260710T090000Z", flat);

        var cal = Ical.Net.Calendar.Load(ics)!;
        Assert.Equal("REQUEST", cal.Method);
        var ev = Assert.Single(cal.Events);
        Assert.Equal("session-abc@fusion-training", ev.Uid);
        Assert.Equal(0, ev.Sequence);
        Assert.Equal("CONFIRMED", ev.Status);
    }

    [Fact]
    public void Build_Cancel_HasMethodCancel_StatusCancelled_HigherSequence()
    {
        var ics = new IcsInviteBuilder().Build(Msg(InviteMethod.Cancel, 2));

        Assert.Contains("METHOD:CANCEL", ics);
        Assert.Contains("SEQUENCE:2", ics);

        var cal = Ical.Net.Calendar.Load(ics)!;
        Assert.Equal("CANCEL", cal.Method);
        var ev = Assert.Single(cal.Events);
        Assert.Equal("CANCELLED", ev.Status);
        Assert.Equal(2, ev.Sequence);
    }
}
