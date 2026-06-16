using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Budget;

public class GetTrainingBudgetsQueryHandlerTests
{
    private static readonly DateTime Y2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2027 = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime InPeriod = new(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc);

    private static async Task<Guid> AddExternalSessionAsync(
        TrainingDbContext ctx, Guid trainingId, Guid partId, DateTime start,
        decimal? trainer = null, decimal? venue = null, decimal? materials = null, decimal? other = null)
    {
        var add = await new AddSessionCommandHandler(ctx).Handle(new AddSessionCommand(
            trainingId, partId, start, start.AddHours(3), "Room", 20, null, null, "Ext", "ext@x.com",
            trainer, venue, materials, other), CancellationToken.None);
        return add.Value.SessionId;
    }

    [Fact]
    public async Task Spend_SumsExternalSessionCosts_InPeriod_ExcludingCancelledAndOutOfPeriod()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var categoryId = ctx.Categories.First().Id;
        var sl = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        var course = new TrainingCourse("Ext OnSite", null, 0, false, BadgeLevel.Bronze, categoryId,
            null, TrainingType.OnSite, null, CostType.External, sl.Id);
        ctx.Trainings.Add(course);
        await ctx.SaveChangesAsync();

        var partId = (await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(course.Id, "P1", null, 3m), CancellationToken.None)).Value;

        // Counts: 3000 + 2000 = 5000
        await AddExternalSessionAsync(ctx, course.Id, partId, InPeriod, trainer: 2000m, venue: 1000m);
        await AddExternalSessionAsync(ctx, course.Id, partId, InPeriod.AddDays(1), materials: 2000m);
        // Cancelled — excluded
        var cancelledId = await AddExternalSessionAsync(ctx, course.Id, partId, InPeriod.AddDays(2), trainer: 9999m);
        await new CancelSessionCommandHandler(ctx).Handle(
            new CancelSessionCommand(cancelledId, "x"), CancellationToken.None);
        // Out of period — excluded
        await AddExternalSessionAsync(ctx, course.Id, partId,
            new DateTime(2028, 1, 1, 9, 0, 0, DateTimeKind.Utc), trainer: 5000m);

        await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(sl.Id, "Annual", Y2026, Y2027, 10000m), CancellationToken.None);

        var result = await new GetTrainingBudgetsQueryHandler(ctx).Handle(
            new GetTrainingBudgetsQuery(sl.Id, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Value!);
        Assert.Equal(5000m, dto.Spend);
        Assert.Equal(5000m, dto.Remaining);
        Assert.Equal(50m, dto.Percentage);
    }

    [Fact]
    public async Task Spend_ExcludesOtherServiceLinesAndInternalTrainings()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var categoryId = ctx.Categories.First().Id;
        var slA = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        var slB = new ServiceLine("Audit", "ASR", "#3B82F6", null, false);
        ctx.ServiceLines.AddRange(slA, slB);
        // External course sponsored by B (must not count against A's budget).
        var courseB = new TrainingCourse("Ext B", null, 0, false, BadgeLevel.Bronze, categoryId,
            null, TrainingType.OnSite, null, CostType.External, slB.Id);
        ctx.Trainings.Add(courseB);
        await ctx.SaveChangesAsync();

        var partB = (await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(courseB.Id, "P1", null, 3m), CancellationToken.None)).Value;
        await AddExternalSessionAsync(ctx, courseB.Id, partB, InPeriod, trainer: 4000m);

        await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(slA.Id, "Annual", Y2026, Y2027, 10000m), CancellationToken.None);

        var result = await new GetTrainingBudgetsQueryHandler(ctx).Handle(
            new GetTrainingBudgetsQuery(slA.Id, null), CancellationToken.None);

        var dto = Assert.Single(result.Value!);
        Assert.Equal(0m, dto.Spend);
        Assert.Equal(0m, dto.Percentage);
    }

    [Fact]
    public async Task Query_Fails_WhenInvalidPeriodTypeFilter()
    {
        await using var ctx = TestDbContextFactory.Create();
        var result = await new GetTrainingBudgetsQueryHandler(ctx).Handle(
            new GetTrainingBudgetsQuery(null, "Weekly"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidPeriodType", result.Error.Code);
    }
}
