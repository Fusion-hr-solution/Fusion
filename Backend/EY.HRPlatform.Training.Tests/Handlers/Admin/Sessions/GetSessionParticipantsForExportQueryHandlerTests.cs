using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Sessions.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Sessions;

public class GetSessionParticipantsForExportQueryHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid sessionId, Guid empAttended, Guid empEnrolled, Guid empCancelled)>
        SeedSessionWithEnrollmentsAsync()
    {
        var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();

        var part = new TrainingPart(training.Id, "Part A", null, 1, 3m);
        ctx.Set<TrainingPart>().Add(part);
        await ctx.SaveChangesAsync();

        var session = new TrainingSession(
            part.Id,
            DateTime.UtcNow.Date.AddDays(7).AddHours(9),
            DateTime.UtcNow.Date.AddDays(7).AddHours(12),
            "Room A", 25, null, null, "Trainer", "t@ey.com");
        ctx.TrainingSessions.Add(session);

        var grade = new Grade("Senior", 3);
        var serviceLine = new ServiceLine("Consulting", "CONS", "#000000");
        ctx.Grades.Add(grade);
        ctx.ServiceLines.Add(serviceLine);
        await ctx.SaveChangesAsync();

        var empAttended = Guid.NewGuid();
        var empEnrolled = Guid.NewGuid();
        var empCancelled = Guid.NewGuid();

        ctx.Set<EmployeeProfile>().Add(new EmployeeProfile(empAttended, grade.Id, serviceLine.Id));

        var enrAttended = new SessionEnrollment(session.Id, empAttended, EnrollmentStatus.Enrolled);
        enrAttended.MarkAttended();
        var enrEnrolled = new SessionEnrollment(session.Id, empEnrolled, EnrollmentStatus.Enrolled);
        var enrCancelled = new SessionEnrollment(session.Id, empCancelled, EnrollmentStatus.Enrolled);
        enrCancelled.Cancel();

        ctx.SessionEnrollments.AddRange(enrAttended, enrEnrolled, enrCancelled);
        await ctx.SaveChangesAsync();

        return (ctx, session.Id, empAttended, empEnrolled, empCancelled);
    }

    [Fact]
    public async Task Handle_ReturnsSessionMetadataAndParticipants()
    {
        var (ctx, sessionId, empAttended, empEnrolled, _) = await SeedSessionWithEnrollmentsAsync();
        var handler = new GetSessionParticipantsForExportQueryHandler(ctx);

        var result = await handler.Handle(
            new GetSessionParticipantsForExportQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(sessionId, result.Value!.SessionId);
        Assert.Equal("Room A", result.Value.Room);
        Assert.Equal(2, result.Value.Participants.Count); // cancelled excluded
        Assert.Contains(result.Value.Participants, p => p.EmployeeId == empAttended);
        Assert.Contains(result.Value.Participants, p => p.EmployeeId == empEnrolled);
    }

    [Fact]
    public async Task Handle_ExcludesCancelledEnrollments()
    {
        var (ctx, sessionId, _, _, empCancelled) = await SeedSessionWithEnrollmentsAsync();
        var handler = new GetSessionParticipantsForExportQueryHandler(ctx);

        var result = await handler.Handle(
            new GetSessionParticipantsForExportQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.DoesNotContain(result.Value!.Participants, p => p.EmployeeId == empCancelled);
    }

    [Fact]
    public async Task Handle_IncludesGradeAndServiceLine_WhenProfileExists()
    {
        var (ctx, sessionId, empAttended, _, _) = await SeedSessionWithEnrollmentsAsync();
        var handler = new GetSessionParticipantsForExportQueryHandler(ctx);

        var result = await handler.Handle(
            new GetSessionParticipantsForExportQuery(sessionId), CancellationToken.None);

        var attended = result.Value!.Participants.First(p => p.EmployeeId == empAttended);
        Assert.Equal("Senior", attended.Grade);
        Assert.Equal("Consulting", attended.ServiceLine);
        Assert.Equal(EnrollmentStatus.Attended.ToString(), attended.AttendanceStatus);
    }

    [Fact]
    public async Task Handle_NullsGradeAndServiceLine_WhenNoProfile()
    {
        var (ctx, sessionId, _, empEnrolled, _) = await SeedSessionWithEnrollmentsAsync();
        var handler = new GetSessionParticipantsForExportQueryHandler(ctx);

        var result = await handler.Handle(
            new GetSessionParticipantsForExportQuery(sessionId), CancellationToken.None);

        var enrolled = result.Value!.Participants.First(p => p.EmployeeId == empEnrolled);
        Assert.Null(enrolled.Grade);
        Assert.Null(enrolled.ServiceLine);
    }

    [Fact]
    public async Task Handle_ReturnsNotFound_WhenSessionDoesNotExist()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetSessionParticipantsForExportQueryHandler(ctx);

        var result = await handler.Handle(
            new GetSessionParticipantsForExportQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
    }
}
