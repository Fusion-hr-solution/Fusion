using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class GetAdminPlanningQueryHandlerTests
{
    private static readonly DateTime From = new(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = new(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc);

    private static TrainingPart SeedCoursePart(TrainingDbContext ctx, out TrainingCourse course, string title = "C# Basics")
    {
        var category = new TrainingCategory("Tech", "Technical");
        ctx.Categories.Add(category);
        course = new TrainingCourse(title, null, 10, false, BadgeLevel.Bronze, category.Id, trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(course);
        var part = new TrainingPart(course.Id, "Day 1", null, 0, 7m);
        ctx.TrainingParts.Add(part);
        return part;
    }

    private static TrainingSession AddSession(TrainingDbContext ctx, Guid partId, string room,
        Guid? trainerEmployeeId = null, DateTime? start = null)
    {
        var s = new TrainingSession(partId,
            start ?? new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
            (start ?? new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc)).AddHours(3),
            room, 20, null, trainerEmployeeId, trainerEmployeeId is null ? null : "Trainer", null);
        ctx.TrainingSessions.Add(s);
        return s;
    }

    [Fact]
    public async Task Handle_FiltersByRoomTrainerAndStatus()
    {
        await using var ctx = TestDbContextFactory.Create();
        var part = SeedCoursePart(ctx, out _);
        var trainer = Guid.NewGuid();
        var target = AddSession(ctx, part.Id, "A101", trainer);
        AddSession(ctx, part.Id, "B202", Guid.NewGuid());
        await ctx.SaveChangesAsync();

        var byRoom = await new GetAdminPlanningQueryHandler(ctx)
            .Handle(new GetAdminPlanningQuery(From, To, null, null, null, "a101", null), CancellationToken.None);
        Assert.True(byRoom.IsSuccess);
        Assert.Equal(target.Id, Assert.Single(byRoom.Value!).Id);

        var byTrainer = await new GetAdminPlanningQueryHandler(ctx)
            .Handle(new GetAdminPlanningQuery(From, To, null, null, trainer, null, null), CancellationToken.None);
        Assert.Equal(target.Id, Assert.Single(byTrainer.Value!).Id);

        var byStatus = await new GetAdminPlanningQueryHandler(ctx)
            .Handle(new GetAdminPlanningQuery(From, To, null, null, null, null, "Planned"), CancellationToken.None);
        Assert.Equal(2, byStatus.Value!.Count);
    }

    [Fact]
    public async Task Handle_AudienceFilter_SelectsTrainingsMappedToServiceLineInCurriculum()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partMapped = SeedCoursePart(ctx, out var mappedCourse, "Mapped");
        var partUnmapped = SeedCoursePart(ctx, out _, "Unmapped");
        var sessionMapped = AddSession(ctx, partMapped.Id, "A101");
        AddSession(ctx, partUnmapped.Id, "B202");

        var serviceLineId = Guid.NewGuid();
        var gradeId = Guid.NewGuid();
        ctx.CurriculumMappings.Add(new CurriculumMapping(gradeId, serviceLineId, mappedCourse.Id, true, 0));
        await ctx.SaveChangesAsync();

        var byServiceLine = await new GetAdminPlanningQueryHandler(ctx)
            .Handle(new GetAdminPlanningQuery(From, To, serviceLineId, null, null, null, null), CancellationToken.None);
        Assert.Equal(sessionMapped.Id, Assert.Single(byServiceLine.Value!).Id);

        // A grade that isn't mapped to the training yields nothing.
        var byOtherGrade = await new GetAdminPlanningQueryHandler(ctx)
            .Handle(new GetAdminPlanningQuery(From, To, serviceLineId, Guid.NewGuid(), null, null, null), CancellationToken.None);
        Assert.Empty(byOtherGrade.Value!);
    }

    [Fact]
    public async Task Handle_EnrolledCount_CountsEnrolledAndAttendedOnly()
    {
        await using var ctx = TestDbContextFactory.Create();
        var part = SeedCoursePart(ctx, out _);
        var session = AddSession(ctx, part.Id, "A101");
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, Guid.NewGuid(), EnrollmentStatus.Enrolled));
        ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, Guid.NewGuid(), EnrollmentStatus.Attended));
        ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, Guid.NewGuid(), EnrollmentStatus.Waitlisted, 1));
        var cancelled = new SessionEnrollment(session.Id, Guid.NewGuid(), EnrollmentStatus.Enrolled);
        cancelled.Cancel();
        ctx.SessionEnrollments.Add(cancelled);
        await ctx.SaveChangesAsync();

        var result = await new GetAdminPlanningQueryHandler(ctx)
            .Handle(new GetAdminPlanningQuery(From, To, null, null, null, null, null), CancellationToken.None);

        Assert.Equal(2, Assert.Single(result.Value!).EnrolledCount);
    }
}
