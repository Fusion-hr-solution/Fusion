using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Enrollment.Commands;
using EY.HRPlatform.Training.Features.Enrollment.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Enrollment;

public class EnrollmentQueryHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid trainingId, Guid part1Id, Guid part2Id, Guid session1Id, Guid session2Id)> SeedAsync()
    {
        var ctx = TestDbContextFactory.Create();

        var category = new TrainingCategory("Technical", "Tech trainings");
        ctx.Categories.Add(category);

        var training = new TrainingCourse(
            "Leadership Workshop", "In-person leadership", credits: 10,
            isMandatory: false, badgeLevel: BadgeLevel.Silver,
            categoryId: category.Id, duration: "6 hours",
            trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        var addPartHandler = new AddPartCommandHandler(ctx);
        var part1Result = await addPartHandler.Handle(
            new AddPartCommand(training.Id, "Part 1", null, 3m), CancellationToken.None);
        var part2Result = await addPartHandler.Handle(
            new AddPartCommand(training.Id, "Part 2", null, 3m), CancellationToken.None);

        var addSessionHandler = new AddSessionCommandHandler(ctx);
        var start1 = DateTime.UtcNow.Date.AddDays(14).AddHours(9);
        var session1Result = await addSessionHandler.Handle(new AddSessionCommand(
            training.Id, part1Result.Value, start1, start1.AddHours(3),
            "Room A", 25, null, null, "Alice", "alice@ey.com"), CancellationToken.None);

        var start2 = DateTime.UtcNow.Date.AddDays(21).AddHours(9);
        var session2Result = await addSessionHandler.Handle(new AddSessionCommand(
            training.Id, part2Result.Value, start2, start2.AddHours(3),
            "Room B", 25, null, null, "Bob", "bob@ey.com"), CancellationToken.None);

        return (ctx, training.Id, part1Result.Value, part2Result.Value,
            session1Result.Value.SessionId, session2Result.Value.SessionId);
    }

    [Fact]
    public async Task GetAvailableSessions_ReturnsPartsAndSessions()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var handler = new GetAvailableSessionsForEnrollmentQueryHandler(ctx);

        var result = await handler.Handle(
            new GetAvailableSessionsForEnrollmentQuery(Guid.NewGuid(), trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(trainingId, result.Value.TrainingId);
        Assert.Equal("Leadership Workshop", result.Value.TrainingTitle);
        Assert.Equal(2, result.Value.Parts.Count);
        Assert.Equal("Part 1", result.Value.Parts[0].Title);
        Assert.Single(result.Value.Parts[0].Sessions);
        Assert.Equal(25, result.Value.Parts[0].Sessions[0].AvailableSpots);
        Assert.False(result.Value.Parts[0].Sessions[0].IsFull);
    }

    [Fact]
    public async Task GetAvailableSessions_ShowsCorrectCapacity_AfterEnrollment()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();

        // Enroll an employee
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        await enrollHandler.Handle(new EnrollInSessionsCommand(
            Guid.NewGuid(), "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        var handler = new GetAvailableSessionsForEnrollmentQueryHandler(ctx);
        var result = await handler.Handle(
            new GetAvailableSessionsForEnrollmentQuery(Guid.NewGuid(), trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(24, result.Value.Parts[0].Sessions[0].AvailableSpots);
        Assert.Equal(1, result.Value.Parts[0].Sessions[0].EnrolledCount);
    }

    [Fact]
    public async Task GetAvailableSessions_HidesCancelledSessions()
    {
        var (ctx, trainingId, part1Id, _, session1Id, _) = await SeedAsync();

        // Cancel session1
        var session = await ctx.TrainingSessions.FindAsync(session1Id);
        session!.Cancel("Cancelled for testing");
        await ctx.SaveChangesAsync();

        var handler = new GetAvailableSessionsForEnrollmentQueryHandler(ctx);
        var result = await handler.Handle(
            new GetAvailableSessionsForEnrollmentQuery(Guid.NewGuid(), trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Parts[0].Sessions); // Part1 has no visible sessions
    }

    [Fact]
    public async Task GetAvailableSessions_Fails_WhenNotOnSite()
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Cat", null);
        ctx.Categories.Add(category);
        var eLearning = new TrainingCourse("EL", null, 5, false, BadgeLevel.Bronze,
            category.Id, "1h", TrainingType.ELearning);
        ctx.Trainings.Add(eLearning);
        await ctx.SaveChangesAsync();

        var handler = new GetAvailableSessionsForEnrollmentQueryHandler(ctx);
        var result = await handler.Handle(
            new GetAvailableSessionsForEnrollmentQuery(Guid.NewGuid(), eLearning.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotOnSite", result.Error.Code);
    }

    [Fact]
    public async Task GetMySessionEnrollments_ReturnsProgress()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var employeeId = Guid.NewGuid();

        // Enroll
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        await enrollHandler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        var handler = new GetMySessionEnrollmentsQueryHandler(ctx);
        var result = await handler.Handle(
            new GetMySessionEnrollmentsQuery(employeeId, trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalParts);
        Assert.Equal(0, result.Value.CompletedParts);
        Assert.False(result.Value.IsTrainingCompleted);
        Assert.Equal(2, result.Value.Parts.Count);
        Assert.All(result.Value.Parts, p => Assert.Equal("Enrolled", p.EnrollmentStatus));
    }

    [Fact]
    public async Task GetMySessionEnrollments_ShowsCompletionProgress()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var employeeId = Guid.NewGuid();

        // Enroll
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        await enrollHandler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        // Mark attendance for part 1
        var markHandler = new MarkAttendanceCommandHandler(ctx, new FakeAttendanceCompletionService());
        await markHandler.Handle(new MarkAttendanceCommand(session1Id, employeeId), CancellationToken.None);

        var handler = new GetMySessionEnrollmentsQueryHandler(ctx);
        var result = await handler.Handle(
            new GetMySessionEnrollmentsQuery(employeeId, trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.CompletedParts);
        Assert.False(result.Value.IsTrainingCompleted);

        var part1 = result.Value.Parts.First(p => p.PartId == part1Id);
        Assert.True(part1.IsAttended);
        Assert.Equal("Attended", part1.EnrollmentStatus);
    }

    [Fact]
    public async Task GetMySessionEnrollments_ShowsComplete_WhenAllPartsAttended()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var employeeId = Guid.NewGuid();

        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        await enrollHandler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        // Mark attendance for both parts
        var markHandler = new MarkAttendanceCommandHandler(ctx, new FakeAttendanceCompletionService());
        await markHandler.Handle(new MarkAttendanceCommand(session1Id, employeeId), CancellationToken.None);
        await markHandler.Handle(new MarkAttendanceCommand(session2Id, employeeId), CancellationToken.None);

        var handler = new GetMySessionEnrollmentsQueryHandler(ctx);
        var result = await handler.Handle(
            new GetMySessionEnrollmentsQuery(employeeId, trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.CompletedParts);
        Assert.True(result.Value.IsTrainingCompleted);
    }

    [Fact]
    public async Task GetMySessionEnrollments_NotEnrolled_ShowsNotEnrolledStatus()
    {
        var (ctx, trainingId, _, _, _, _) = await SeedAsync();
        var handler = new GetMySessionEnrollmentsQueryHandler(ctx);

        var result = await handler.Handle(
            new GetMySessionEnrollmentsQuery(Guid.NewGuid(), trainingId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value.CompletedParts);
        Assert.All(result.Value.Parts, p => Assert.Equal("NotEnrolled", p.EnrollmentStatus));
    }
}


