using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Invites;
using EY.HRPlatform.Training.Features.Calendar.Sync;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class CalendarSyncProcessorTests
{
    private sealed class FakeInviteSync : ISessionInviteSync
    {
        public List<SessionInviteMessage> Sent { get; } = new();

        public Task SendAsync(SessionInviteMessage message, CancellationToken cancellationToken)
        {
            Sent.Add(message);
            return Task.CompletedTask;
        }
    }

    private static CalendarSyncProcessor Processor(TrainingDbContext ctx, FakeInviteSync fake) =>
        new(ctx, fake, Options.Create(new CalendarEmailOptions { FromEmail = "training@ey", FromName = "EY Academy" }));

    private static async Task<Guid> SeedSession(
        TrainingDbContext ctx, params (Guid emp, string? email, EnrollmentStatus status)[] enrollments)
    {
        var cat = new TrainingCategory("Tech", "t");
        ctx.Categories.Add(cat);
        var course = new TrainingCourse("C#", null, 10, false, BadgeLevel.Bronze, cat.Id, trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(course);
        var part = new TrainingPart(course.Id, "Day 1", null, 0, 7m);
        ctx.TrainingParts.Add(part);
        var session = new TrainingSession(part.Id,
            new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc),
            "A101", 20, null, null, "Jane", null);
        ctx.TrainingSessions.Add(session);
        foreach (var (emp, email, status) in enrollments)
            ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, emp, status, 0, "Name", email));
        await ctx.SaveChangesAsync();
        return session.Id;
    }

    private static async Task<CalendarSyncOutbox> Enqueue(
        TrainingDbContext ctx, CalendarSyncType type, Guid sessionId, Guid? emp = null)
    {
        var row = new CalendarSyncOutbox(type, sessionId, emp);
        ctx.CalendarSyncOutboxes.Add(row);
        await ctx.SaveChangesAsync();
        return row;
    }

    [Fact]
    public async Task AttendeeAdded_SendsRequestAtSeqZero_AndIsIdempotent()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeInviteSync();
        var emp = Guid.NewGuid();
        var sessionId = await SeedSession(ctx, (emp, "a@x.com", EnrollmentStatus.Enrolled));

        var row1 = await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, emp);
        await Processor(ctx, fake).ProcessAsync(row1, CancellationToken.None);

        var msg = Assert.Single(fake.Sent);
        Assert.Equal(InviteMethod.Request, msg.Method);
        Assert.Equal(0, msg.Sequence);
        Assert.Equal("a@x.com", msg.Recipient.Email);
        Assert.Equal($"session-{sessionId:D}@fusion-training", msg.ICalUid);
        Assert.NotNull(row1.ProcessedAt);
        Assert.Equal(0, (await ctx.SessionInviteDeliveries.SingleAsync()).LastSentSequence);

        // A duplicate AttendeeAdded row must NOT re-send (per-attendee sequence+method guard).
        var row2 = await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, emp);
        await Processor(ctx, fake).ProcessAsync(row2, CancellationToken.None);
        Assert.Single(fake.Sent);
    }

    [Fact]
    public async Task SessionRescheduled_BumpsSequence_RequestsConfirmedOnly()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeInviteSync();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var c = Guid.NewGuid();
        var d = Guid.NewGuid();
        var sessionId = await SeedSession(ctx,
            (a, "a@x", EnrollmentStatus.Enrolled),
            (b, "b@x", EnrollmentStatus.Attended),
            (c, "c@x", EnrollmentStatus.Cancelled),
            (d, "d@x", EnrollmentStatus.Waitlisted));

        await Processor(ctx, fake).ProcessAsync(await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, a), CancellationToken.None);
        await Processor(ctx, fake).ProcessAsync(await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, b), CancellationToken.None);
        fake.Sent.Clear();

        var resched = await Enqueue(ctx, CalendarSyncType.SessionRescheduled, sessionId);
        await Processor(ctx, fake).ProcessAsync(resched, CancellationToken.None);

        Assert.Equal(2, fake.Sent.Count); // a + b; not c (cancelled), not d (waitlisted)
        Assert.All(fake.Sent, m => Assert.Equal(InviteMethod.Request, m.Method));
        Assert.All(fake.Sent, m => Assert.Equal(1, m.Sequence));
        Assert.Equal(1, (await ctx.ExternalCalendarSyncs.SingleAsync()).Sequence);
    }

    [Fact]
    public async Task SessionCancelled_SendsCancelToInvited_MarksSyncCancelled()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeInviteSync();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var sessionId = await SeedSession(ctx, (a, "a@x", EnrollmentStatus.Enrolled), (b, "b@x", EnrollmentStatus.Attended));

        await Processor(ctx, fake).ProcessAsync(await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, a), CancellationToken.None);
        await Processor(ctx, fake).ProcessAsync(await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, b), CancellationToken.None);
        fake.Sent.Clear();

        await Processor(ctx, fake).ProcessAsync(await Enqueue(ctx, CalendarSyncType.SessionCancelled, sessionId), CancellationToken.None);

        Assert.Equal(2, fake.Sent.Count);
        Assert.All(fake.Sent, m => Assert.Equal(InviteMethod.Cancel, m.Method));
        Assert.Equal(CalendarSyncStatus.Cancelled, (await ctx.ExternalCalendarSyncs.SingleAsync()).Status);
    }

    [Fact]
    public async Task SessionCancelled_DoesNotCancel_NeverInvitedAttendee()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeInviteSync();
        var a = Guid.NewGuid();
        var sessionId = await SeedSession(ctx, (a, "a@x", EnrollmentStatus.Enrolled));

        await Processor(ctx, fake).ProcessAsync(await Enqueue(ctx, CalendarSyncType.SessionCancelled, sessionId), CancellationToken.None);

        Assert.Empty(fake.Sent); // never sent a REQUEST → no CANCEL
    }

    [Fact]
    public async Task AttendeeRemoved_SendsCancelToThatLearner_AtHigherSequence()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeInviteSync();
        var a = Guid.NewGuid();
        var sessionId = await SeedSession(ctx, (a, "a@x", EnrollmentStatus.Cancelled));

        // They were previously invited at SEQUENCE 0.
        ctx.ExternalCalendarSyncs.Add(new ExternalCalendarSync(sessionId, $"session-{sessionId:D}@fusion-training", CalendarProvider.Imip));
        var delivery = new SessionInviteDelivery(sessionId, a, "a@x", "A");
        delivery.RecordSent(0, InviteMethod.Request);
        ctx.SessionInviteDeliveries.Add(delivery);
        await ctx.SaveChangesAsync();

        var row = await Enqueue(ctx, CalendarSyncType.AttendeeRemoved, sessionId, a);
        await Processor(ctx, fake).ProcessAsync(row, CancellationToken.None);

        var msg = Assert.Single(fake.Sent);
        Assert.Equal(InviteMethod.Cancel, msg.Method);
        Assert.Equal("a@x", msg.Recipient.Email);
        Assert.Equal(1, msg.Sequence); // bumped above the REQUEST (seq 0) so the CANCEL outranks it
    }

    [Fact]
    public async Task Recipient_WithNoEmail_IsSkipped()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeInviteSync();
        var a = Guid.NewGuid();
        var sessionId = await SeedSession(ctx, (a, null, EnrollmentStatus.Enrolled));

        var row = await Enqueue(ctx, CalendarSyncType.AttendeeAdded, sessionId, a);
        await Processor(ctx, fake).ProcessAsync(row, CancellationToken.None);

        Assert.Empty(fake.Sent);
        Assert.NotNull(row.ProcessedAt);
    }
}
