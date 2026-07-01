using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Sessions;

public class SessionCommandHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid trainingId, Guid partId)> SeedAsync()
    {
        var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var addPart = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(training.Id, "Part 1", null, 3m), CancellationToken.None);
        return (ctx, training.Id, addPart.Value);
    }

    [Fact]
    public async Task AddSession_Succeeds_WhenValid()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var handler = new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier());
        var start = DateTime.UtcNow.Date.AddDays(7).AddHours(9);

        var result = await handler.Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room A", 25, null, null, "Alice", "alice@ey.com"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value.SessionId);
        Assert.Empty(result.Value.RoomConflicts);
    }

    [Fact]
    public async Task AddSession_Fails_WhenEndBeforeStart()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var handler = new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier());
        var start = DateTime.UtcNow.AddDays(7);

        var result = await handler.Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(-1), "Room A", 10, null, null, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidTimeRange", result.Error.Code);
    }

    [Fact]
    public async Task AddSession_Fails_WhenCapacityZero()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var handler = new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier());
        var start = DateTime.UtcNow.AddDays(7);

        var result = await handler.Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(2), "Room A", 0, null, null, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidCapacity", result.Error.Code);
    }

    [Fact]
    public async Task AddSession_DetectsRoomConflict_WhenOverlappingSameRoom()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var handler = new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier());
        var start = DateTime.UtcNow.Date.AddDays(7).AddHours(9);

        await handler.Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room A", 25, null, null, null, null), CancellationToken.None);

        // Second session overlaps in same room.
        var second = await handler.Handle(new AddSessionCommand(
            trainingId, partId, start.AddHours(1), start.AddHours(2), "room a", 10, null, null, null, null),
            CancellationToken.None);

        Assert.True(second.IsSuccess);
        Assert.Single(second.Value.RoomConflicts);
    }

    [Fact]
    public async Task CancelSession_Succeeds_AndPersistsReason()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.AddDays(7);
        var add = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(2), "Room B", 10, null, null, null, null), CancellationToken.None);

        var result = await new CancelSessionCommandHandler(ctx).Handle(
            new CancelSessionCommand(add.Value.SessionId, "Trainer unavailable"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var session = await ctx.TrainingSessions.FindAsync(add.Value.SessionId);
        Assert.Equal(SessionStatus.Cancelled, session!.Status);
        Assert.Equal("Trainer unavailable", session.CancelReason);
    }

    [Fact]
    public async Task CancelSession_Fails_WhenReasonEmpty()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.AddDays(7);
        var add = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(2), "Room B", 10, null, null, null, null), CancellationToken.None);

        var result = await new CancelSessionCommandHandler(ctx).Handle(
            new CancelSessionCommand(add.Value.SessionId, "  "), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("CancelReasonRequired", result.Error.Code);
    }

    [Fact]
    public async Task DuplicateSession_CreatesNRecurringOccurrences()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.Date.AddDays(7).AddHours(9);
        var add = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room C", 20, null, null, null, null), CancellationToken.None);

        var dup = await new DuplicateSessionCommandHandler(ctx).Handle(new DuplicateSessionCommand(
            add.Value.SessionId, start.AddDays(7), Occurrences: 3, IntervalDays: 7), CancellationToken.None);

        Assert.True(dup.IsSuccess);
        Assert.Equal(3, dup.Value.CreatedSessionIds.Count);
    }

    [Fact]
    public async Task GetSessions_FiltersByTrainingId()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.AddDays(7);
        await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(2), "Room D", 10, null, null, null, null), CancellationToken.None);

        var result = await new GetSessionsQueryHandler(ctx).Handle(
            new GetSessionsQuery(trainingId, null, null, null, null, null, 1, 20), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal(trainingId, result.Value.Items[0].TrainingId);
    }
}
