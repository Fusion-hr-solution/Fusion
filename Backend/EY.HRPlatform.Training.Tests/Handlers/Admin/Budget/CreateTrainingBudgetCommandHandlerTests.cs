using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Budget;

public class CreateTrainingBudgetCommandHandlerTests
{
    private static readonly DateTime Y2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2027 = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2028 = new(2028, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static async Task<(Infrastructure.Persistence.TrainingDbContext ctx, Guid serviceLineId)> SeedAsync()
    {
        var ctx = TestDbContextFactory.Create();
        var sl = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        await ctx.SaveChangesAsync();
        return (ctx, sl.Id);
    }

    [Fact]
    public async Task Handle_CreatesBudget_WhenValid()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 50000m), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var budget = await ctx.TrainingBudgets.FindAsync(result.Value);
        Assert.NotNull(budget);
        Assert.Equal(slId, budget!.ServiceLineId);
        Assert.Equal(50000m, budget.AllocatedAmount);
    }

    [Fact]
    public async Task Handle_Fails_WhenServiceLineNotFound()
    {
        await using var ctx = TestDbContextFactory.Create();

        var result = await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(Guid.NewGuid(), "Annual", Y2026, Y2027, 1000m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_Fails_WhenInvalidPeriodType()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slId, "Monthly", Y2026, Y2027, 1000m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidPeriodType", result.Error.Code);
    }

    [Fact]
    public async Task Handle_Fails_WhenPeriodEndNotAfterStart()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slId, "Custom", Y2027, Y2026, 1000m), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidPeriod", result.Error.Code);
    }

    [Fact]
    public async Task Handle_Fails_WhenPeriodsOverlapForSameServiceLine()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var handler = new CreateTrainingBudgetCommandHandler(ctx);
        await handler.Handle(new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None);

        var overlap = await handler.Handle(new CreateTrainingBudgetCommand(
            slId, "Custom",
            new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            2000m), CancellationToken.None);

        Assert.True(overlap.IsFailure);
        Assert.Contains("Overlap", overlap.Error.Code);
    }

    [Fact]
    public async Task Handle_Allows_AdjacentNonOverlappingPeriods()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var handler = new CreateTrainingBudgetCommandHandler(ctx);
        await handler.Handle(new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None);

        // Starts exactly where the previous period ends — half-open ranges do not overlap.
        var adjacent = await handler.Handle(
            new CreateTrainingBudgetCommand(slId, "Annual", Y2027, Y2028, 2000m), CancellationToken.None);

        Assert.True(adjacent.IsSuccess);
    }

    [Fact]
    public async Task Handle_Allows_OverlappingPeriods_ForDifferentServiceLines()
    {
        var (ctx, slId) = await SeedAsync();
        await using var _ = ctx;
        var sl2 = new ServiceLine("Audit", "ASR", "#3B82F6", null, false);
        ctx.ServiceLines.Add(sl2);
        await ctx.SaveChangesAsync();
        var handler = new CreateTrainingBudgetCommandHandler(ctx);
        await handler.Handle(new CreateTrainingBudgetCommand(slId, "Annual", Y2026, Y2027, 1000m), CancellationToken.None);

        var other = await handler.Handle(
            new CreateTrainingBudgetCommand(sl2.Id, "Annual", Y2026, Y2027, 2000m), CancellationToken.None);

        Assert.True(other.IsSuccess);
    }
}
