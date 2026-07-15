using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class GetMyCalendarQueryHandlerTests
{
    private static readonly DateTime From = new(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = new(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc);

    private static (TrainingCourse course, TrainingPart part) SeedCoursePart(TrainingDbContext ctx, string title = "C# Basics")
    {
        var category = new TrainingCategory("Tech", "Technical");
        ctx.Categories.Add(category);
        var course = new TrainingCourse(title, null, 10, false, BadgeLevel.Bronze, category.Id, trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(course);
        var part = new TrainingPart(course.Id, "Day 1", null, 0, 7m);
        ctx.TrainingParts.Add(part);
        return (course, part);
    }

    private static TrainingSession AddSession(TrainingDbContext ctx, Guid partId, DateTime start, DateTime end, string room = "A101")
    {
        var s = new TrainingSession(partId, start, end, room, 20, null, null, null, null);
        ctx.TrainingSessions.Add(s);
        return s;
    }

    [Fact]
    public async Task Handle_ReturnsEnrolledSessionAndDeadline_WithinWindow_ExcludesOutOfWindow()
    {
        await using var ctx = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var (course, part) = SeedCoursePart(ctx);

        var inWindow = AddSession(ctx, part.Id,
            new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 10, 17, 0, 0, DateTimeKind.Utc));
        var outWindow = AddSession(ctx, part.Id,
            new DateTime(2026, 8, 10, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 8, 10, 17, 0, 0, DateTimeKind.Utc), "B202");
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.Add(new SessionEnrollment(inWindow.Id, employeeId, EnrollmentStatus.Enrolled, 0, "Me", "me@x.com"));
        ctx.SessionEnrollments.Add(new SessionEnrollment(outWindow.Id, employeeId, EnrollmentStatus.Enrolled, 0, "Me", "me@x.com"));
        ctx.Assignments.Add(new TrainingAssignment(course.Id, employeeId, AssignmentType.HrAssigned,
            new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc)));
        await ctx.SaveChangesAsync();

        var result = await new GetMyCalendarQueryHandler(ctx)
            .Handle(new GetMyCalendarQuery(employeeId, From, To), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var events = result.Value!;
        Assert.Equal(2, events.Count);
        Assert.Contains(events, e => e.Kind == "session" && e.Id == inWindow.Id && !e.AllDay);
        Assert.Contains(events, e => e.Kind == "deadline" && e.TrainingId == course.Id && e.AllDay);
        Assert.DoesNotContain(events, e => e.Id == outWindow.Id);
    }

    [Fact]
    public async Task Handle_ExcludesCancelledSessionsAndCancelledEnrollments()
    {
        await using var ctx = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var (_, part) = SeedCoursePart(ctx);

        var cancelledSession = AddSession(ctx, part.Id,
            new DateTime(2026, 7, 5, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 5, 12, 0, 0, DateTimeKind.Utc));
        var normalSession = AddSession(ctx, part.Id,
            new DateTime(2026, 7, 6, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 6, 12, 0, 0, DateTimeKind.Utc), "B202");
        await ctx.SaveChangesAsync();

        cancelledSession.Cancel("room flooded");
        ctx.SessionEnrollments.Add(new SessionEnrollment(cancelledSession.Id, employeeId, EnrollmentStatus.Enrolled));
        var cancelledEnrollment = new SessionEnrollment(normalSession.Id, employeeId, EnrollmentStatus.Enrolled);
        cancelledEnrollment.Cancel();
        ctx.SessionEnrollments.Add(cancelledEnrollment);
        await ctx.SaveChangesAsync();

        var result = await new GetMyCalendarQueryHandler(ctx)
            .Handle(new GetMyCalendarQuery(employeeId, From, To), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task Handle_MarksWaitlistedMuted()
    {
        await using var ctx = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var (_, part) = SeedCoursePart(ctx);
        var session = AddSession(ctx, part.Id,
            new DateTime(2026, 7, 8, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 8, 12, 0, 0, DateTimeKind.Utc));
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, employeeId, EnrollmentStatus.Waitlisted, 1));
        await ctx.SaveChangesAsync();

        var result = await new GetMyCalendarQueryHandler(ctx)
            .Handle(new GetMyCalendarQuery(employeeId, From, To), CancellationToken.None);

        var ev = Assert.Single(result.Value!);
        Assert.True(ev.IsWaitlisted);
        Assert.Equal("Waitlisted", ev.EnrollmentStatus);
    }

    [Fact]
    public async Task Handle_ReturnsOnlyOwnEvents()
    {
        await using var ctx = TestDbContextFactory.Create();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var (_, part) = SeedCoursePart(ctx);
        var session = AddSession(ctx, part.Id,
            new DateTime(2026, 7, 9, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 9, 12, 0, 0, DateTimeKind.Utc));
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, me, EnrollmentStatus.Enrolled));
        ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, other, EnrollmentStatus.Enrolled));
        await ctx.SaveChangesAsync();

        var result = await new GetMyCalendarQueryHandler(ctx)
            .Handle(new GetMyCalendarQuery(me, From, To), CancellationToken.None);

        var ev = Assert.Single(result.Value!);
        Assert.Equal(session.Id, ev.Id);
    }
}
