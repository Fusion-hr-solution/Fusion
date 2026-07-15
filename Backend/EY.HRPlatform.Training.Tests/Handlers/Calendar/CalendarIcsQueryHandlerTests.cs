using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Feed;
using EY.HRPlatform.Training.Features.Calendar.Ics;
using EY.HRPlatform.Training.Features.Calendar.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using EY.HRPlatform.Training.Tests.TestHelpers;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class CalendarIcsQueryHandlerTests
{
    // ---------------- GetMyCalendarIcsQuery (the subscription feed) ----------------

    private static GetMyCalendarIcsQueryHandler FeedHandler(
        TrainingDbContext ctx, ICalendarFeedTokenService tokens, List<CalendarEventDto> events)
    {
        var sender = new Mock<ISender>();
        sender.Setup(s => s.Send(It.IsAny<GetMyCalendarQuery>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(Result.Success(events));
        return new GetMyCalendarIcsQueryHandler(ctx, tokens, sender.Object, new IcsCalendarFeed());
    }

    private static CalendarEventDto Ev(Guid id, string title, bool waitlisted) => new()
    {
        Id = id,
        Kind = "session",
        Title = title,
        StartUtc = new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
        EndUtc = new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc),
        IsWaitlisted = waitlisted
    };

    [Fact]
    public async Task Feed_BlankOrUnknownToken_Fails()
    {
        await using var ctx = TestDbContextFactory.Create();
        var handler = FeedHandler(ctx, new CalendarFeedTokenService(), new List<CalendarEventDto>());

        Assert.True((await handler.Handle(new GetMyCalendarIcsQuery(null), CancellationToken.None)).IsFailure);
        Assert.True((await handler.Handle(new GetMyCalendarIcsQuery("not-a-real-token"), CancellationToken.None)).IsFailure);
    }

    [Fact]
    public async Task Feed_RevokedToken_Fails()
    {
        await using var ctx = TestDbContextFactory.Create();
        var tokens = new CalendarFeedTokenService();
        var (token, hash) = tokens.Issue();
        var row = new CalendarFeedToken(Guid.NewGuid(), hash);
        row.Revoke();
        ctx.CalendarFeedTokens.Add(row);
        await ctx.SaveChangesAsync();

        var handler = FeedHandler(ctx, tokens, new List<CalendarEventDto>());
        Assert.True((await handler.Handle(new GetMyCalendarIcsQuery(token), CancellationToken.None)).IsFailure);
    }

    [Fact]
    public async Task Feed_ValidToken_BuildsIcs_ExcludingWaitlisted()
    {
        await using var ctx = TestDbContextFactory.Create();
        var tokens = new CalendarFeedTokenService();
        var (token, hash) = tokens.Issue();
        ctx.CalendarFeedTokens.Add(new CalendarFeedToken(Guid.NewGuid(), hash));
        await ctx.SaveChangesAsync();

        var confirmedId = Guid.NewGuid();
        var events = new List<CalendarEventDto>
        {
            Ev(confirmedId, "Confirmed", waitlisted: false),
            Ev(Guid.NewGuid(), "Waitlisted", waitlisted: true)
        };

        var result = await FeedHandler(ctx, tokens, events).Handle(new GetMyCalendarIcsQuery(token), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var parsed = Ical.Net.Calendar.Load(result.Value!)!;
        var ev = Assert.Single(parsed.Events); // waitlisted is excluded from the feed
        Assert.Equal($"session-{confirmedId:D}@fusion-training", ev.Uid);
    }

    // ---------------- GetSessionIcsQuery (single-session download) ----------------

    private static Guid SeedSession(TrainingDbContext ctx)
    {
        var category = new TrainingCategory("Tech", "t");
        ctx.Categories.Add(category);
        var course = new TrainingCourse("C#", null, 10, false, BadgeLevel.Bronze, category.Id, trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(course);
        var part = new TrainingPart(course.Id, "Day 1", null, 0, 7m);
        ctx.TrainingParts.Add(part);
        var session = new TrainingSession(part.Id,
            new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc),
            "A101", 20, null, null, null, null);
        ctx.TrainingSessions.Add(session);
        return session.Id;
    }

    [Fact]
    public async Task SessionIcs_ReturnsEvent_ForEnrolledLearner()
    {
        await using var ctx = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var sessionId = SeedSession(ctx);
        ctx.SessionEnrollments.Add(new SessionEnrollment(sessionId, employeeId, EnrollmentStatus.Enrolled));
        await ctx.SaveChangesAsync();

        var result = await new GetSessionIcsQueryHandler(ctx, new IcsCalendarFeed())
            .Handle(new GetSessionIcsQuery(sessionId, employeeId, IsAdmin: false), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var ev = Assert.Single(Ical.Net.Calendar.Load(result.Value!)!.Events);
        Assert.Equal($"session-{sessionId:D}@fusion-training", ev.Uid);
        Assert.Contains("Day 1", result.Value!);
    }

    [Fact]
    public async Task SessionIcs_ReturnsEvent_ForAdmin_EvenIfNotEnrolled()
    {
        await using var ctx = TestDbContextFactory.Create();
        var sessionId = SeedSession(ctx);
        await ctx.SaveChangesAsync();

        var result = await new GetSessionIcsQueryHandler(ctx, new IcsCalendarFeed())
            .Handle(new GetSessionIcsQuery(sessionId, Guid.NewGuid(), IsAdmin: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task SessionIcs_Fails_ForNonEnrolledNonAdmin()
    {
        await using var ctx = TestDbContextFactory.Create();
        var sessionId = SeedSession(ctx);
        await ctx.SaveChangesAsync();

        var result = await new GetSessionIcsQueryHandler(ctx, new IcsCalendarFeed())
            .Handle(new GetSessionIcsQuery(sessionId, Guid.NewGuid(), IsAdmin: false), CancellationToken.None);

        Assert.True(result.IsFailure); // IDOR guard: not enrolled, not admin → 404
    }

    [Fact]
    public async Task SessionIcs_Fails_ForMissingSession()
    {
        await using var ctx = TestDbContextFactory.Create();
        var result = await new GetSessionIcsQueryHandler(ctx, new IcsCalendarFeed())
            .Handle(new GetSessionIcsQuery(Guid.NewGuid(), Guid.NewGuid(), IsAdmin: true), CancellationToken.None);
        Assert.True(result.IsFailure);
    }
}
