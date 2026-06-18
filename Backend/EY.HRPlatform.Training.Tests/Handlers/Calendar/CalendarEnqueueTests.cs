using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class CalendarEnqueueTests
{
    private static async Task<Guid> SeedSession(TrainingDbContext ctx)
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
            "A101", 20, null, null, null, null);
        ctx.TrainingSessions.Add(session);
        await ctx.SaveChangesAsync();
        return session.Id;
    }

    [Fact]
    public async Task CancelSession_Enqueues_SessionCancelled()
    {
        await using var ctx = TestDbContextFactory.Create();
        var sessionId = await SeedSession(ctx);

        var result = await new CancelSessionCommandHandler(ctx)
            .Handle(new CancelSessionCommand(sessionId, "room flooded"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var row = await ctx.CalendarSyncOutboxes.SingleAsync();
        Assert.Equal(CalendarSyncType.SessionCancelled, row.Type);
        Assert.Equal(sessionId, row.SessionId);
    }

    [Fact]
    public async Task UpdateSession_Enqueues_SessionRescheduled_OnlyWhenCalendarFieldChanges()
    {
        await using var ctx = TestDbContextFactory.Create();
        var sessionId = await SeedSession(ctx);

        // No-op update (same start/end/room) → nothing enqueued.
        await new UpdateSessionCommandHandler(ctx).Handle(new UpdateSessionCommand(
            sessionId,
            new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc),
            "A101", 20, null, null, null, null), CancellationToken.None);
        Assert.Equal(0, await ctx.CalendarSyncOutboxes.CountAsync());

        // Change the start → SessionRescheduled enqueued.
        await new UpdateSessionCommandHandler(ctx).Handle(new UpdateSessionCommand(
            sessionId,
            new DateTime(2026, 7, 11, 9, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 11, 12, 0, 0, DateTimeKind.Utc),
            "A101", 20, null, null, null, null), CancellationToken.None);

        var row = await ctx.CalendarSyncOutboxes.SingleAsync();
        Assert.Equal(CalendarSyncType.SessionRescheduled, row.Type);
    }
}
