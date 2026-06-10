using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Queries;

/// <summary>
/// US-5.3.2 — Attendance dashboards. Absence is derived (decision A): an enrollment is
/// "present" when Attended, "absent" when the session has closed without attendance,
/// and "pending" while the session is still open.
/// </summary>
public class AttendanceDashboardQueryHandlerTests
{
    /// <summary>
    /// Seeds a course + one part (durationHours) + one session in the given time window,
    /// returns the context and the new session id.
    /// </summary>
    private static async Task<(TrainingDbContext ctx, Guid trainingId, Guid sessionId)> SeedSessionAsync(
        DateTime start, DateTime end, decimal durationHours = 3m)
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Tech", null);
        ctx.Categories.Add(category);
        var training = new TrainingCourse(
            "Attendance Workshop", null, 5, false, BadgeLevel.Bronze,
            category.Id, "3h", TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        var partResult = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(training.Id, "Part 1", null, durationHours), CancellationToken.None);

        var sessionResult = await new AddSessionCommandHandler(ctx).Handle(new AddSessionCommand(
            training.Id, partResult.Value, start, end,
            "Room A", 25, null, null, "Alice", "alice@ey.com"), CancellationToken.None);

        return (ctx, training.Id, sessionResult.Value!.SessionId);
    }

    private static async Task EnrollAsync(
        TrainingDbContext ctx, Guid sessionId, Guid employeeId, EnrollmentStatus status, string name)
    {
        ctx.SessionEnrollments.Add(new SessionEnrollment(
            sessionId, employeeId, status, 0, name, $"{name.Replace(" ", "").ToLowerInvariant()}@ey.com"));
        await ctx.SaveChangesAsync();
    }

    // ── AC#1 Per-session ────────────────────────────────────────────────────

    [Fact]
    public async Task SessionAttendance_DerivesPresentAndAbsent_WhenSessionClosed()
    {
        var start = DateTime.UtcNow.AddHours(-4);
        var (ctx, _, sessionId) = await SeedSessionAsync(start, start.AddHours(3));
        await EnrollAsync(ctx, sessionId, Guid.NewGuid(), EnrollmentStatus.Attended, "Present One");
        await EnrollAsync(ctx, sessionId, Guid.NewGuid(), EnrollmentStatus.Enrolled, "Absent One");
        await EnrollAsync(ctx, sessionId, Guid.NewGuid(), EnrollmentStatus.Cancelled, "Cancelled One");
        await EnrollAsync(ctx, sessionId, Guid.NewGuid(), EnrollmentStatus.Waitlisted, "Waitlisted One");

        var result = await new GetSessionAttendanceQueryHandler(ctx).Handle(
            new GetSessionAttendanceQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.True(dto.IsClosed);
        Assert.Equal(1, dto.PresentCount);
        Assert.Equal(1, dto.AbsentCount);
        Assert.Equal(0, dto.PendingCount);
        Assert.Equal(2, dto.CountedTotal);
        Assert.Equal(50d, dto.AttendanceRate);
        Assert.Equal(2, dto.Attendees.Count); // cancelled + waitlisted excluded
    }

    [Fact]
    public async Task SessionAttendance_MarksPending_WhenSessionOpen()
    {
        var start = DateTime.UtcNow.AddHours(2);
        var (ctx, _, sessionId) = await SeedSessionAsync(start, start.AddHours(3));
        await EnrollAsync(ctx, sessionId, Guid.NewGuid(), EnrollmentStatus.Enrolled, "Pending One");

        var result = await new GetSessionAttendanceQueryHandler(ctx).Handle(
            new GetSessionAttendanceQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.False(dto.IsClosed);
        Assert.Equal(0, dto.PresentCount);
        Assert.Equal(0, dto.AbsentCount);
        Assert.Equal(1, dto.PendingCount);
        Assert.Equal(0, dto.CountedTotal);
        Assert.Equal(0d, dto.AttendanceRate);
    }

    [Fact]
    public async Task SessionAttendance_ReturnsNotFound_WhenSessionMissing()
    {
        var ctx = TestDbContextFactory.Create();

        var result = await new GetSessionAttendanceQueryHandler(ctx).Handle(
            new GetSessionAttendanceQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    // ── AC#2 Per-employee ───────────────────────────────────────────────────

    [Fact]
    public async Task EmployeeHistory_SumsInPersonHours_ForAttendedSessionsOnly()
    {
        var employeeId = Guid.NewGuid();
        var start = DateTime.UtcNow.AddHours(-4);
        var (ctx, trainingId, sessionId) = await SeedSessionAsync(start, start.AddHours(3), durationHours: 3m);
        await EnrollAsync(ctx, sessionId, employeeId, EnrollmentStatus.Attended, "Worker");

        // A second closed session the employee was absent from must not add hours.
        var part2 = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(trainingId, "Part 2", null, 5m), CancellationToken.None);
        var start2 = DateTime.UtcNow.AddHours(-10);
        var session2 = await new AddSessionCommandHandler(ctx).Handle(new AddSessionCommand(
            trainingId, part2.Value, start2, start2.AddHours(5),
            "Room B", 25, null, null, "Alice", "alice@ey.com"), CancellationToken.None);
        await EnrollAsync(ctx, session2.Value!.SessionId, employeeId, EnrollmentStatus.Enrolled, "Worker");

        var result = await new GetEmployeeAttendanceHistoryQueryHandler(ctx).Handle(
            new GetEmployeeAttendanceHistoryQuery(employeeId, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.Equal(3m, dto.TotalInPersonHours);
        Assert.Equal(1, dto.PresentCount);
        Assert.Equal(1, dto.AbsentCount);
        Assert.Equal(50d, dto.OverallAttendanceRate);
        Assert.Equal(2, dto.Records.Count);
    }

    // ── AC#3 Aggregations ───────────────────────────────────────────────────

    [Fact]
    public async Task ByGrade_AddsUnassignedBucket_WhenEmployeeHasNoProfile()
    {
        var start = DateTime.UtcNow.AddHours(-4);
        var (ctx, _, sessionId) = await SeedSessionAsync(start, start.AddHours(3));

        var grade = new Grade("Staff", 1);
        ctx.Grades.Add(grade);
        var gradedEmployee = Guid.NewGuid();
        ctx.EmployeeProfiles.Add(new EmployeeProfile(gradedEmployee, grade.Id, null));
        await ctx.SaveChangesAsync();

        await EnrollAsync(ctx, sessionId, gradedEmployee, EnrollmentStatus.Attended, "Graded");
        await EnrollAsync(ctx, sessionId, Guid.NewGuid(), EnrollmentStatus.Enrolled, "Unassigned");

        var result = await new GetAttendanceByGradeQueryHandler(ctx).Handle(
            new GetAttendanceByGradeQuery(new AttendanceFilter()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var rows = result.Value!;
        var staff = Assert.Single(rows, r => r.GradeName == "Staff");
        Assert.Equal(100d, staff.AttendanceRate);
        var unassigned = Assert.Single(rows, r => r.GradeName == "Unassigned");
        Assert.Null(unassigned.GradeId);
        Assert.Equal(0d, unassigned.AttendanceRate);
        Assert.Equal(1, unassigned.CountedTotal);
    }

    [Fact]
    public async Task Summary_CountsDeliveredHoursOncePerSession_AndExcludesOpenSessions()
    {
        var closedStart = DateTime.UtcNow.AddHours(-4);
        var (ctx, trainingId, closedSession) = await SeedSessionAsync(closedStart, closedStart.AddHours(3), durationHours: 3m);

        // Two attendees on the same closed session — hours still counted once.
        await EnrollAsync(ctx, closedSession, Guid.NewGuid(), EnrollmentStatus.Attended, "A");
        await EnrollAsync(ctx, closedSession, Guid.NewGuid(), EnrollmentStatus.Enrolled, "B");

        // An open future session must not contribute to the summary.
        var openStart = DateTime.UtcNow.AddDays(1);
        var openPart = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(trainingId, "Future Part", null, 9m), CancellationToken.None);
        var openSession = await new AddSessionCommandHandler(ctx).Handle(new AddSessionCommand(
            trainingId, openPart.Value, openStart, openStart.AddHours(9),
            "Room C", 25, null, null, "Alice", "alice@ey.com"), CancellationToken.None);
        await EnrollAsync(ctx, openSession.Value!.SessionId, Guid.NewGuid(), EnrollmentStatus.Enrolled, "C");

        var result = await new GetAttendanceSummaryQueryHandler(ctx).Handle(
            new GetAttendanceSummaryQuery(new AttendanceFilter()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.Equal(1, dto.TotalSessions);
        Assert.Equal(3m, dto.TotalHoursDelivered);
        Assert.Equal(1, dto.TotalPresent);
        Assert.Equal(1, dto.TotalAbsent);
        Assert.Equal(50d, dto.OverallAttendanceRate);
    }
}
