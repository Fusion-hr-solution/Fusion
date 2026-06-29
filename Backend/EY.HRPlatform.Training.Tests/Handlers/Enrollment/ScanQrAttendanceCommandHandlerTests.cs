using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Features.Enrollment.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Enrollment;

public class ScanQrAttendanceCommandHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid sessionId, Guid employeeId, string payload)> SeedEnrolledAsync(
        DateTime? sessionStart = null,
        EnrollmentStatus status = EnrollmentStatus.Enrolled)
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Tech", null);
        ctx.Categories.Add(category);
        var training = new TrainingCourse(
            "QR Scan Workshop", null, 5, false, BadgeLevel.Bronze,
            category.Id, "3h", TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        var partResult = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(training.Id, "Part 1", null, 3m), CancellationToken.None);

        var start = sessionStart ?? DateTime.UtcNow.AddMinutes(-10);
        var sessionResult = await new AddSessionCommandHandler(ctx).Handle(new AddSessionCommand(
            training.Id, partResult.Value, start, start.AddHours(3),
            "Room A", 25, null, null, "Alice", "alice@ey.com"), CancellationToken.None);

        var employeeId = Guid.NewGuid();
        var enrollment = new SessionEnrollment(
            sessionResult.Value.SessionId, employeeId, status, 0, "Bob Tester", "bob@ey.com");
        ctx.SessionEnrollments.Add(enrollment);
        await ctx.SaveChangesAsync();

        var qr = new QrTokenService();
        var genResult = await new GenerateSessionQrCodeCommandHandler(ctx, qr).Handle(
            new GenerateSessionQrCodeCommand(sessionResult.Value.SessionId, false),
            CancellationToken.None);

        return (ctx, sessionResult.Value.SessionId, employeeId, genResult.Value!.Payload);
    }

    [Fact]
    public async Task Scan_Succeeds_AndMarksAttended()
    {
        var (ctx, sessionId, employeeId, payload) = await SeedEnrolledAsync();
        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());

        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(sessionId, result.Value!.SessionId);
        Assert.Equal("QR Scan Workshop", result.Value.TrainingTitle);
        Assert.Equal("Part 1", result.Value.PartTitle);

        var enrollment = await ctx.SessionEnrollments.SingleAsync(
            e => e.SessionId == sessionId && e.EmployeeId == employeeId);
        Assert.Equal(EnrollmentStatus.Attended, enrollment.Status);
        Assert.NotNull(enrollment.AttendedAt);
    }

    [Fact]
    public async Task Scan_Fails_WhenPayloadEmpty()
    {
        var ctx = TestDbContextFactory.Create();
        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());

        var result = await handler.Handle(
            new ScanQrAttendanceCommand(Guid.NewGuid(), ""), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.PayloadRequired", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenPayloadMalformed()
    {
        var ctx = TestDbContextFactory.Create();
        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());

        var result = await handler.Handle(
            new ScanQrAttendanceCommand(Guid.NewGuid(), "totally-not-a-qr-payload"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.Malformed", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenTokenNotGenerated()
    {
        // Build a syntactically-valid payload for a session that has no token row
        var ctx = TestDbContextFactory.Create();
        var fakeSessionId = Guid.NewGuid();
        var payload = $"v1.{fakeSessionId:N}.123.AAA";

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(Guid.NewGuid(), payload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenRevoked()
    {
        var (ctx, sessionId, employeeId, payload) = await SeedEnrolledAsync();
        await new RevokeSessionQrCodeCommandHandler(ctx).Handle(
            new RevokeSessionQrCodeCommand(sessionId), CancellationToken.None);

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.Revoked", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenTokenExpired()
    {
        var (ctx, sessionId, employeeId, payload) = await SeedEnrolledAsync();

        // Force-expire the token by manipulating the DB row directly
        var token = await ctx.SessionAttendanceTokens.SingleAsync(t => t.SessionId == sessionId);
        var expiredField = typeof(SessionAttendanceToken).GetProperty(nameof(SessionAttendanceToken.ValidUntil))!;
        expiredField.SetValue(token, DateTime.UtcNow.AddMinutes(-1));
        await ctx.SaveChangesAsync();

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.Expired", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenSignatureTampered()
    {
        var (ctx, _, employeeId, payload) = await SeedEnrolledAsync();

        // Replace last char of signature
        var tampered = payload[..^1] + (payload[^1] == 'A' ? 'B' : 'A');

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, tampered), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.Expired", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenWindowOutOfRange()
    {
        var (ctx, sessionId, employeeId, _) = await SeedEnrolledAsync();
        var token = await ctx.SessionAttendanceTokens.AsNoTracking()
            .SingleAsync(t => t.SessionId == sessionId);

        // Build a payload for a window 10 rotations in the past
        var qr = new QrTokenService();
        var oldNow = DateTime.UtcNow.AddSeconds(-token.RotationSeconds * 10);
        var oldPayload = qr.Build(token, oldNow).Payload;

        var handler = new ScanQrAttendanceCommandHandler(ctx, qr, new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, oldPayload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Qr.Expired", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Succeeds_WithPreviousWindowPayload()
    {
        var (ctx, sessionId, employeeId, _) = await SeedEnrolledAsync();
        var token = await ctx.SessionAttendanceTokens.AsNoTracking()
            .SingleAsync(t => t.SessionId == sessionId);

        // Build a payload for the immediately previous window (within grace)
        var qr = new QrTokenService();
        var prevWindowNow = DateTime.UtcNow.AddSeconds(-token.RotationSeconds);
        var prevPayload = qr.Build(token, prevWindowNow).Payload;

        var handler = new ScanQrAttendanceCommandHandler(ctx, qr, new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, prevPayload), CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Scan_Fails_WhenEmployeeNotEnrolled()
    {
        var (ctx, _, _, payload) = await SeedEnrolledAsync();
        var unrelatedEmployee = Guid.NewGuid();

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(unrelatedEmployee, payload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.NotEnrolled", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenEnrollmentCancelled()
    {
        var (ctx, _, employeeId, payload) = await SeedEnrolledAsync(status: EnrollmentStatus.Cancelled);

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.NotEnrolled", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenWaitlisted()
    {
        var (ctx, _, employeeId, payload) = await SeedEnrolledAsync(status: EnrollmentStatus.Waitlisted);

        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());
        var result = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.Waitlisted", result.Error.Code);
    }

    [Fact]
    public async Task Scan_Fails_WhenAlreadyAttended()
    {
        var (ctx, _, employeeId, payload) = await SeedEnrolledAsync();
        var handler = new ScanQrAttendanceCommandHandler(ctx, new QrTokenService(), new FakeAttendanceCompletionService());

        // First scan succeeds
        var first = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);
        Assert.True(first.IsSuccess);

        // Second scan must fail with conflict
        var second = await handler.Handle(
            new ScanQrAttendanceCommand(employeeId, payload), CancellationToken.None);

        Assert.True(second.IsFailure);
        Assert.Equal("Enrollment.AlreadyAttended", second.Error.Code);
    }
}
