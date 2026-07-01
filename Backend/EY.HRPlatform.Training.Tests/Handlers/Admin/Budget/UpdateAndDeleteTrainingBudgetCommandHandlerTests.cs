using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Budget;

public class UpdateAndDeleteTrainingBudgetCommandHandlerTests
{
    private static readonly DateTime Y2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2027 = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2028 = new(2028, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2029 = new(2029, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static async Task<(TrainingDbContext ctx, Guid serviceLineId)> SeedAsync()
    {
        var ctx = TestDbContextFactory.Create();
        var sl = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        await ctx.SaveChangesAsync();
        return (ctx, sl.Id);
    }

    [Fact]
    public async Task Update_ChangesAllocation_WhenValid()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var id = (await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None)).Value;

        var result = await new UpdateTrainingBudgetCommandHandler(ctx).Handle(
            new UpdateTrainingBudgetCommand(id, "Annual", Y2026, Y2027, 7777m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var budget = await ctx.TrainingBudgets.FindAsync(id);
        Assert.Equal(7777m, budget!.AllocatedAmount);
    }

    [Fact]
    public async Task Update_Fails_WhenNotFound()
    {
        await using var ctx = TestDbContextFactory.Create();
        var result = await new UpdateTrainingBudgetCommandHandler(ctx).Handle(
            new UpdateTrainingBudgetCommand(Guid.NewGuid(), "Annual", Y2026, Y2027, 1000m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Update_Succeeds_WhenOnlyOverlapsItself()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var id = (await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None)).Value;

        // Shrinks its own range — overlap check must exclude self.
        var result = await new UpdateTrainingBudgetCommandHandler(ctx).Handle(
            new UpdateTrainingBudgetCommand(id, "Custom", Y2026,
                new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc), 1000m), CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Update_Fails_WhenOverlapsAnotherBudget()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var create = new CreateTrainingBudgetCommandHandler(ctx);
        var id = (await create.Handle(new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None)).Value;
        await create.Handle(new CreateTrainingBudgetCommand(slId, "Annual", Y2028, Y2029, 2000m), CancellationToken.None);

        // Stretch the first budget into the second one's range.
        var result = await new UpdateTrainingBudgetCommandHandler(ctx).Handle(
            new UpdateTrainingBudgetCommand(id, "Custom", Y2026,
                new DateTime(2028, 6, 1, 0, 0, 0, DateTimeKind.Utc), 1000m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Overlap", result.Error.Code);
    }

    [Fact]
    public async Task Delete_RemovesBudget()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var id = (await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None)).Value;

        var result = await new DeleteTrainingBudgetCommandHandler(ctx).Handle(
            new DeleteTrainingBudgetCommand(id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await ctx.TrainingBudgets.FindAsync(id));
    }

    [Fact]
    public async Task Delete_Fails_WhenNotFound()
    {
        await using var ctx = TestDbContextFactory.Create();
        var result = await new DeleteTrainingBudgetCommandHandler(ctx).Handle(
            new DeleteTrainingBudgetCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
