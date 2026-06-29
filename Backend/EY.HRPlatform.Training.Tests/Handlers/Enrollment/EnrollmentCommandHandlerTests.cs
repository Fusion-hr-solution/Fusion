using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Enrollment.Commands;
using EY.HRPlatform.Training.Features.Enrollment.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Enrollment;

public class EnrollmentCommandHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid trainingId, Guid part1Id, Guid part2Id, Guid session1Id, Guid session2Id)> SeedAsync()
    {
        var ctx = TestDbContextFactory.Create();

        // Create category + on-site training
        var category = new TrainingCategory("Technical", "Tech trainings");
        ctx.Categories.Add(category);

        var training = new TrainingCourse(
            "Leadership Workshop", "In-person leadership", credits: 10,
            isMandatory: false, badgeLevel: BadgeLevel.Silver,
            categoryId: category.Id, duration: "6 hours",
            trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        // Add 2 parts
        var addPartHandler = new AddPartCommandHandler(ctx);
        var part1Result = await addPartHandler.Handle(
            new AddPartCommand(training.Id, "Part 1 - Foundations", null, 3m), CancellationToken.None);
        var part2Result = await addPartHandler.Handle(
            new AddPartCommand(training.Id, "Part 2 - Practice", null, 3m), CancellationToken.None);

        // Add sessions
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
    public async Task EnrollInSessions_Succeeds_WhenAllPartsSelected()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var handler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        var result = await handler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(trainingId, result.Value.TrainingId);
        Assert.Equal(2, result.Value.Enrollments.Count);
        Assert.All(result.Value.Enrollments, e => Assert.Equal("Enrolled", e.Status));
    }

    [Fact]
    public async Task EnrollInSessions_Fails_WhenNotOnSiteTraining()
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Cat", null);
        ctx.Categories.Add(category);
        var eLearning = new TrainingCourse("EL Training", null, 5, false, BadgeLevel.Bronze,
            category.Id, "1h", TrainingType.ELearning);
        ctx.Trainings.Add(eLearning);
        await ctx.SaveChangesAsync();

        var handler = new EnrollInSessionsCommandHandler(ctx);
        var result = await handler.Handle(new EnrollInSessionsCommand(
            Guid.NewGuid(), "Test User", "test@test.com", eLearning.Id, []), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotOnSite", result.Error.Code);
    }

    [Fact]
    public async Task EnrollInSessions_Succeeds_WithPartialSelection()
    {
        var (ctx, trainingId, part1Id, _, session1Id, _) = await SeedAsync();
        var handler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        // Only select session for part 1 — partial enrollment is now allowed
        var result = await handler.Handle(new EnrollInSessionsCommand(
            employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id)
            ]), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var enrollments = await ctx.SessionEnrollments
            .Where(e => e.EmployeeId == employeeId)
            .ToListAsync();
        Assert.Single(enrollments);
        Assert.Equal(session1Id, enrollments[0].SessionId);
    }

    [Fact]
    public async Task EnrollInSessions_Fails_WhenSessionPartMismatch()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var handler = new EnrollInSessionsCommandHandler(ctx);

        // Swap sessions (session1 belongs to part1, not part2)
        var result = await handler.Handle(new EnrollInSessionsCommand(
            Guid.NewGuid(), "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session2Id),
                new SessionSelectionItem(part2Id, session1Id)
            ]), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("SessionPartMismatch", result.Error.Code);
    }

    [Fact]
    public async Task EnrollInSessions_Fails_WhenAlreadyEnrolled()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var handler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        // First enrollment succeeds
        await handler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        // Second enrollment for same employee fails
        var result = await handler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("AlreadyEnrolled", result.Error.Code);
    }

    [Fact]
    public async Task EnrollInSessions_Waitlists_WhenSessionFull()
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Cat", null);
        ctx.Categories.Add(category);
        var training = new TrainingCourse("Small Workshop", null, 5, false, BadgeLevel.Bronze,
            category.Id, "2h", TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        var addPartHandler = new AddPartCommandHandler(ctx);
        var partResult = await addPartHandler.Handle(
            new AddPartCommand(training.Id, "Only Part", null, 2m), CancellationToken.None);

        var addSessionHandler = new AddSessionCommandHandler(ctx);
        var start = DateTime.UtcNow.Date.AddDays(14).AddHours(9);
        var sessionResult = await addSessionHandler.Handle(new AddSessionCommand(
            training.Id, partResult.Value, start, start.AddHours(2),
            "Room A", 1, null, null, null, null), CancellationToken.None); // Capacity = 1

        var handler = new EnrollInSessionsCommandHandler(ctx);

        // First employee fills the session
        var result1 = await handler.Handle(new EnrollInSessionsCommand(
            Guid.NewGuid(), "Test User", "test@test.com", training.Id, [
                new SessionSelectionItem(partResult.Value, sessionResult.Value.SessionId)
            ]), CancellationToken.None);

        Assert.True(result1.IsSuccess);
        Assert.Equal("Enrolled", result1.Value.Enrollments[0].Status);

        // Second employee gets waitlisted
        var result2 = await handler.Handle(new EnrollInSessionsCommand(
            Guid.NewGuid(), "Test User", "test@test.com", training.Id, [
                new SessionSelectionItem(partResult.Value, sessionResult.Value.SessionId)
            ]), CancellationToken.None);

        Assert.True(result2.IsSuccess);
        Assert.Equal("Waitlisted", result2.Value.Enrollments[0].Status);
        Assert.Equal(1, result2.Value.Enrollments[0].WaitlistPosition);
    }

    [Fact]
    public async Task EnrollInSessions_CreatesAssignment_WhenNoneExists()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var handler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        await handler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        var assignment = await ctx.Assignments
            .FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.TrainingId == trainingId);
        Assert.NotNull(assignment);
        Assert.Equal(AssignmentType.SelfEnroll, assignment.AssignmentType);
    }

    [Fact]
    public async Task EnrollInSessions_Fails_WhenSessionCancelled()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();

        // Add a second session to part1 so the part remains enrollable
        var addSessionHandler = new AddSessionCommandHandler(ctx);
        var altStart = DateTime.UtcNow.Date.AddDays(15).AddHours(9);
        await addSessionHandler.Handle(new AddSessionCommand(
            trainingId, part1Id, altStart, altStart.AddHours(3),
            "Room C", 25, null, null, "Carol", "carol@ey.com"), CancellationToken.None);

        // Cancel session1
        var session = await ctx.TrainingSessions.FindAsync(session1Id);
        session!.Cancel("Test cancellation");
        await ctx.SaveChangesAsync();

        var handler = new EnrollInSessionsCommandHandler(ctx);
        var result = await handler.Handle(new EnrollInSessionsCommand(
            Guid.NewGuid(), "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("SessionCancelled", result.Error.Code);
    }

    [Fact]
    public async Task CancelEnrollment_Succeeds_BeforeDeadline()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        await enrollHandler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        var cancelHandler = new CancelSessionEnrollmentCommandHandler(ctx);
        var result = await cancelHandler.Handle(
            new CancelSessionEnrollmentCommand(employeeId, session1Id), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var enrollment = await ctx.SessionEnrollments
            .FirstAsync(e => e.EmployeeId == employeeId && e.SessionId == session1Id);
        Assert.Equal(EnrollmentStatus.Cancelled, enrollment.Status);
    }

    [Fact]
    public async Task CancelEnrollment_DoesNotAffectOtherParts()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        await enrollHandler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        var cancelHandler = new CancelSessionEnrollmentCommandHandler(ctx);
        await cancelHandler.Handle(
            new CancelSessionEnrollmentCommand(employeeId, session1Id), CancellationToken.None);

        // Session2 enrollment should still be active
        var session2Enrollment = await ctx.SessionEnrollments
            .FirstAsync(e => e.EmployeeId == employeeId && e.SessionId == session2Id);
        Assert.Equal(EnrollmentStatus.Enrolled, session2Enrollment.Status);
    }

    [Fact]
    public async Task CancelEnrollment_PromotesWaitlistedPerson()
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Cat", null);
        ctx.Categories.Add(category);
        var training = new TrainingCourse("Tiny Workshop", null, 5, false, BadgeLevel.Bronze,
            category.Id, "2h", TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        var addPartHandler = new AddPartCommandHandler(ctx);
        var partResult = await addPartHandler.Handle(
            new AddPartCommand(training.Id, "Only Part", null, 2m), CancellationToken.None);

        var addSessionHandler = new AddSessionCommandHandler(ctx);
        var start = DateTime.UtcNow.Date.AddDays(14).AddHours(9);
        var sessionResult = await addSessionHandler.Handle(new AddSessionCommand(
            training.Id, partResult.Value, start, start.AddHours(2),
            "Room A", 1, null, null, null, null), CancellationToken.None);

        var sessionId = sessionResult.Value.SessionId;
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);

        var employee1 = Guid.NewGuid();
        var employee2 = Guid.NewGuid();

        // Employee 1 enrolled
        await enrollHandler.Handle(new EnrollInSessionsCommand(
            employee1, "Test User", "test@test.com", training.Id, [new SessionSelectionItem(partResult.Value, sessionId)]),
            CancellationToken.None);

        // Employee 2 waitlisted
        await enrollHandler.Handle(new EnrollInSessionsCommand(
            employee2, "Test User 2", "test2@test.com", training.Id, [new SessionSelectionItem(partResult.Value, sessionId)]),
            CancellationToken.None);

        // Employee 1 cancels
        var cancelHandler = new CancelSessionEnrollmentCommandHandler(ctx);
        await cancelHandler.Handle(
            new CancelSessionEnrollmentCommand(employee1, sessionId), CancellationToken.None);

        // Employee 2 should be promoted
        var e2Enrollment = await ctx.SessionEnrollments
            .FirstAsync(e => e.EmployeeId == employee2 && e.SessionId == sessionId);
        Assert.Equal(EnrollmentStatus.Enrolled, e2Enrollment.Status);
        Assert.Equal(0, e2Enrollment.WaitlistPosition);
    }

    [Fact]
    public async Task CancelEnrollment_Fails_WhenNotEnrolled()
    {
        var (ctx, _, _, _, session1Id, _) = await SeedAsync();
        var cancelHandler = new CancelSessionEnrollmentCommandHandler(ctx);

        var result = await cancelHandler.Handle(
            new CancelSessionEnrollmentCommand(Guid.NewGuid(), session1Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task MarkAttendance_Succeeds_WhenEnrolled()
    {
        var (ctx, trainingId, part1Id, part2Id, session1Id, session2Id) = await SeedAsync();
        var enrollHandler = new EnrollInSessionsCommandHandler(ctx);
        var employeeId = Guid.NewGuid();

        await enrollHandler.Handle(new EnrollInSessionsCommand(employeeId, "Test User", "test@test.com", trainingId, [
                new SessionSelectionItem(part1Id, session1Id),
                new SessionSelectionItem(part2Id, session2Id)
            ]), CancellationToken.None);

        var markHandler = new MarkAttendanceCommandHandler(ctx, new FakeAttendanceCompletionService());
        var result = await markHandler.Handle(
            new MarkAttendanceCommand(session1Id, employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var enrollment = await ctx.SessionEnrollments
            .FirstAsync(e => e.EmployeeId == employeeId && e.SessionId == session1Id);
        Assert.Equal(EnrollmentStatus.Attended, enrollment.Status);
    }

    [Fact]
    public async Task MarkAttendance_Fails_WhenNotEnrolled()
    {
        var (ctx, _, _, _, session1Id, _) = await SeedAsync();
        var markHandler = new MarkAttendanceCommandHandler(ctx, new FakeAttendanceCompletionService());

        var result = await markHandler.Handle(
            new MarkAttendanceCommand(session1Id, Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}


