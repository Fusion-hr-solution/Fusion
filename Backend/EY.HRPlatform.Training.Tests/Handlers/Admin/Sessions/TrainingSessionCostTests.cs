using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Sessions;

public class TrainingSessionCostTests
{
    private static async Task<(TrainingDbContext ctx, Guid trainingId, Guid partId)> SeedAsync()
    {
        var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var partId = (await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(training.Id, "P1", null, 3m), CancellationToken.None)).Value;
        return (ctx, training.Id, partId);
    }

    [Fact]
    public async Task AddSession_PersistsCosts_AndComputesTotal()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.AddDays(7);

        var add = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room A", 20, null, null, "Ext", "ext@x.com",
            ExternalTrainerCost: 1000m, VenueCost: 500m, MaterialsCost: 250m, OtherCost: null),
            CancellationToken.None);

        var session = await ctx.TrainingSessions.FindAsync(add.Value.SessionId);
        Assert.NotNull(session);
        Assert.Equal(1000m, session!.ExternalTrainerCost);
        Assert.Equal(500m, session.VenueCost);
        Assert.Equal(1750m, session.TotalCost);
    }

    [Fact]
    public async Task AddSession_TotalCostNull_WhenNoCostsProvided()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.AddDays(7);

        var add = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room A", 20, null, null, null, null),
            CancellationToken.None);

        var session = await ctx.TrainingSessions.FindAsync(add.Value.SessionId);
        Assert.Null(session!.TotalCost);
    }

    [Fact]
    public async Task GetSessionDetail_ProjectsTotalCost()
    {
        var (ctx, trainingId, partId) = await SeedAsync();
        var start = DateTime.UtcNow.AddDays(7);
        var add = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room A", 20, null, null, "Ext", "ext@x.com",
            ExternalTrainerCost: 800m, VenueCost: 200m), CancellationToken.None);

        var detail = await new GetSessionDetailQueryHandler(ctx).Handle(
            new GetSessionDetailQuery(add.Value.SessionId), CancellationToken.None);

        Assert.True(detail.IsSuccess);
        Assert.Equal(1000m, detail.Value!.TotalCost);
        Assert.Equal(800m, detail.Value.ExternalTrainerCost);
    }
}
