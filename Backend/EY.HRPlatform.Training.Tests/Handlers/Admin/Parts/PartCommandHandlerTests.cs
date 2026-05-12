using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Parts;

public class PartCommandHandlerTests
{
    [Fact]
    public async Task AddPart_AssignsNextOrderIndex_WhenValid()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var handler = new AddPartCommandHandler(ctx);

        var r1 = await handler.Handle(new AddPartCommand(training.Id, "Foundations", "Week 1", 3m), CancellationToken.None);
        var r2 = await handler.Handle(new AddPartCommand(training.Id, "Communication", null, 2m), CancellationToken.None);

        Assert.True(r1.IsSuccess);
        Assert.True(r2.IsSuccess);
        var parts = await ctx.TrainingParts.Where(p => p.TrainingId == training.Id).OrderBy(p => p.OrderIndex).ToListAsync();
        Assert.Equal(2, parts.Count);
        Assert.Equal(0, parts[0].OrderIndex);
        Assert.Equal(1, parts[1].OrderIndex);
    }

    [Fact]
    public async Task AddPart_Fails_WhenTrainingMissing()
    {
        await using var ctx = TestDbContextFactory.Create();
        var handler = new AddPartCommandHandler(ctx);

        var result = await handler.Handle(new AddPartCommand(Guid.NewGuid(), "X", null, 1m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task AddPart_Fails_WhenTitleEmpty()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var handler = new AddPartCommandHandler(ctx);

        var result = await handler.Handle(new AddPartCommand(training.Id, "  ", null, 1m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("TitleRequired", result.Error.Code);
    }

    [Fact]
    public async Task UpdatePart_UpdatesFields()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var addHandler = new AddPartCommandHandler(ctx);
        var addResult = await addHandler.Handle(new AddPartCommand(training.Id, "Old", null, 1m), CancellationToken.None);
        var updateHandler = new UpdatePartCommandHandler(ctx);

        var result = await updateHandler.Handle(
            new UpdatePartCommand(training.Id, addResult.Value, "New Title", "Desc", 4.5m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var part = await ctx.TrainingParts.FindAsync(addResult.Value);
        Assert.Equal("New Title", part!.Title);
        Assert.Equal(4.5m, part.DurationHours);
    }

    [Fact]
    public async Task DeletePart_RemovesPart()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var addResult = await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(training.Id, "Doomed", null, 1m), CancellationToken.None);

        var result = await new DeletePartCommandHandler(ctx).Handle(
            new DeletePartCommand(training.Id, addResult.Value), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await ctx.TrainingParts.FindAsync(addResult.Value));
    }

    [Fact]
    public async Task ReorderParts_ReassignsOrderIndices()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();
        var addHandler = new AddPartCommandHandler(ctx);
        var p1 = (await addHandler.Handle(new AddPartCommand(training.Id, "A", null, 1m), CancellationToken.None)).Value;
        var p2 = (await addHandler.Handle(new AddPartCommand(training.Id, "B", null, 1m), CancellationToken.None)).Value;
        var p3 = (await addHandler.Handle(new AddPartCommand(training.Id, "C", null, 1m), CancellationToken.None)).Value;

        var handler = new ReorderPartsCommandHandler(ctx);
        var result = await handler.Handle(new ReorderPartsCommand(training.Id, [p3, p1, p2]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var ordered = await ctx.TrainingParts
            .Where(p => p.TrainingId == training.Id)
            .OrderBy(p => p.OrderIndex)
            .ToListAsync();
        Assert.Equal(p3, ordered[0].Id);
        Assert.Equal(p1, ordered[1].Id);
        Assert.Equal(p2, ordered[2].Id);
    }
}
