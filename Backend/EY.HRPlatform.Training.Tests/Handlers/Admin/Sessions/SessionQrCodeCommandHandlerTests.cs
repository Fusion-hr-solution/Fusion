using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Queries;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Sessions;

public class SessionQrCodeCommandHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid trainingId, Guid partId, Guid sessionId)> SeedSessionAsync(
        DateTime? startUtc = null)
    {
        var ctx = TestDbContextFactory.Create();
        var category = new TrainingCategory("Tech", null);
        ctx.Categories.Add(category);
        var training = new TrainingCourse(
            "QR Workshop", null, 5, false, BadgeLevel.Bronze,
            category.Id, "3h", TrainingType.OnSite);
        ctx.Trainings.Add(training);
        await ctx.SaveChangesAsync();

        var partResult = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(training.Id, "Part 1", null, 3m), CancellationToken.None);

        var start = startUtc ?? DateTime.UtcNow.AddHours(1);
        var sessionResult = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            training.Id, partResult.Value, start, start.AddHours(3),
            "Room A", 25, null, null, "Alice", "alice@ey.com"), CancellationToken.None);

        return (ctx, training.Id, partResult.Value, sessionResult.Value.SessionId);
    }

    [Fact]
    public async Task Generate_CreatesNewToken_WhenNoneExists()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());

        var result = await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEmpty(result.Value!.Payload);
        Assert.Equal(300, result.Value.RotationSeconds);
        Assert.False(result.Value.IsRevoked);
        Assert.True(result.Value.ExpiresAt > DateTime.UtcNow);

        var token = await ctx.SessionAttendanceTokens.SingleAsync(t => t.SessionId == sessionId);
        Assert.NotEmpty(token.Secret);
    }

    [Fact]
    public async Task Generate_KeepsSameSecret_WhenRegenerateFalseAndTokenExists()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());

        await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);
        var firstSecret = await ctx.SessionAttendanceTokens
            .Where(t => t.SessionId == sessionId).Select(t => t.Secret).SingleAsync();

        await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);
        var secondSecret = await ctx.SessionAttendanceTokens
            .Where(t => t.SessionId == sessionId).Select(t => t.Secret).SingleAsync();

        Assert.Equal(firstSecret, secondSecret);
    }

    [Fact]
    public async Task Generate_RotatesSecret_WhenRegenerateTrue()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());

        await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);
        var firstSecret = await ctx.SessionAttendanceTokens
            .Where(t => t.SessionId == sessionId).Select(t => t.Secret).SingleAsync();

        await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, true), CancellationToken.None);
        var secondSecret = await ctx.SessionAttendanceTokens
            .Where(t => t.SessionId == sessionId).Select(t => t.Secret).SingleAsync();

        Assert.NotEqual(firstSecret, secondSecret);
    }

    [Fact]
    public async Task Generate_ReactivatesToken_WhenRevoked()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());
        var revokeHandler = new RevokeSessionQrCodeCommandHandler(ctx);

        await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);
        await revokeHandler.Handle(new RevokeSessionQrCodeCommand(sessionId), CancellationToken.None);

        var result = await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.IsRevoked);
        var token = await ctx.SessionAttendanceTokens.SingleAsync(t => t.SessionId == sessionId);
        Assert.False(token.IsRevoked);
        Assert.Null(token.RevokedAt);
    }

    [Fact]
    public async Task Generate_Fails_WhenSessionNotFound()
    {
        var ctx = TestDbContextFactory.Create();
        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());

        var result = await handler.Handle(new GenerateSessionQrCodeCommand(Guid.NewGuid(), false), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Generate_Fails_WhenSessionCancelled()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        await new CancelSessionCommandHandler(ctx).Handle(
            new CancelSessionCommand(sessionId, "Trainer ill"), CancellationToken.None);

        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());
        var result = await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Session.Cancelled", result.Error.Code);
    }

    [Fact]
    public async Task Generate_Fails_WhenSessionAlreadyEnded()
    {
        // Past session: end was 2h ago, so end + 30min buffer is still in the past
        var (ctx, _, _, sessionId) = await SeedSessionAsync(DateTime.UtcNow.AddHours(-5));

        var handler = new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService());
        var result = await handler.Handle(new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Session.Ended", result.Error.Code);
    }

    [Fact]
    public async Task Revoke_MarksToken_AsRevoked()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        await new GenerateSessionQrCodeCommandHandler(ctx, new QrTokenService()).Handle(
            new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);

        var result = await new RevokeSessionQrCodeCommandHandler(ctx).Handle(
            new RevokeSessionQrCodeCommand(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var token = await ctx.SessionAttendanceTokens.SingleAsync(t => t.SessionId == sessionId);
        Assert.True(token.IsRevoked);
        Assert.NotNull(token.RevokedAt);
    }

    [Fact]
    public async Task Revoke_Fails_WhenNoTokenExists()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var result = await new RevokeSessionQrCodeCommandHandler(ctx).Handle(
            new RevokeSessionQrCodeCommand(sessionId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetSessionQrCode_ReturnsCurrentPayload_WhenTokenExists()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var qr = new QrTokenService();
        await new GenerateSessionQrCodeCommandHandler(ctx, qr).Handle(
            new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);

        var result = await new GetSessionQrCodeQueryHandler(ctx, qr).Handle(
            new GetSessionQrCodeQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEmpty(result.Value!.Payload);
        Assert.False(result.Value.IsRevoked);
    }

    [Fact]
    public async Task GetSessionQrCode_Fails_WhenNoTokenExists()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var result = await new GetSessionQrCodeQueryHandler(ctx, new QrTokenService()).Handle(
            new GetSessionQrCodeQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetSessionQrCode_ReportsRevoked_AfterRevocation()
    {
        var (ctx, _, _, sessionId) = await SeedSessionAsync();
        var qr = new QrTokenService();
        await new GenerateSessionQrCodeCommandHandler(ctx, qr).Handle(
            new GenerateSessionQrCodeCommand(sessionId, false), CancellationToken.None);
        await new RevokeSessionQrCodeCommandHandler(ctx).Handle(
            new RevokeSessionQrCodeCommand(sessionId), CancellationToken.None);

        var result = await new GetSessionQrCodeQueryHandler(ctx, qr).Handle(
            new GetSessionQrCodeQuery(sessionId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.IsRevoked);
    }
}
