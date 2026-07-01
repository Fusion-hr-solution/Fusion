using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Budget;

public class BudgetDashboardQueryHandlerTests
{
    private static readonly DateTime Y2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2027 = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static async Task<(Guid serviceLineId, Guid courseId, Guid partId)> AddExternalCourseAsync(
        TrainingDbContext ctx, string slName, string slCode, decimal allocated)
    {
        var categoryId = ctx.Categories.First().Id;
        var sl = new ServiceLine(slName, slCode, "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        var course = new TrainingCourse($"Ext {slName}", null, 0, false, BadgeLevel.Bronze, categoryId,
            null, TrainingType.OnSite, null, CostType.External, sl.Id);
        ctx.Trainings.Add(course);
        await ctx.SaveChangesAsync();

        var partId = (await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(course.Id, "P1", null, 3m), CancellationToken.None)).Value;
        await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(sl.Id, "Annual", Y2026, Y2027, allocated), CancellationToken.None);
        return (sl.Id, course.Id, partId);
    }

    private static Task AddSession(TrainingDbContext ctx, Guid courseId, Guid partId, DateTime start, decimal amount) =>
        new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            courseId, partId, start, start.AddHours(3), "Room", 20, null, null, "Ext Trainer", "ext@x.com",
            ExternalTrainerCost: amount), CancellationToken.None);

    [Fact]
    public async Task Summary_AggregatesPerServiceLine_WithKpisAndAlerts()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var (slTax, taxCourse, taxPart) = await AddExternalCourseAsync(ctx, "Tax", "TAX", 10000m);
        var (slAudit, auditCourse, auditPart) = await AddExternalCourseAsync(ctx, "Audit", "ASR", 5000m);

        await AddSession(ctx, taxCourse, taxPart, new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc), 8500m);   // 85%
        await AddSession(ctx, auditCourse, auditPart, new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc), 1000m); // 20%

        var result = await new GetBudgetDashboardSummaryQueryHandler(ctx).Handle(
            new GetBudgetDashboardSummaryQuery(null, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.Equal(15000m, dto.TotalAllocated);
        Assert.Equal(9500m, dto.TotalSpent);
        Assert.Equal(5500m, dto.TotalRemaining);

        var tax = dto.ByServiceLine.Single(r => r.ServiceLineId == slTax);
        Assert.Equal(10000m, tax.Allocated);
        Assert.Equal(8500m, tax.Spent);
        Assert.Equal(85m, tax.PercentConsumed);

        var audit = dto.ByServiceLine.Single(r => r.ServiceLineId == slAudit);
        Assert.Equal(20m, audit.PercentConsumed);

        var alert = Assert.Single(dto.Alerts);
        Assert.Equal(slTax, alert.ServiceLineId);
        Assert.Equal(80, alert.ThresholdBand);
    }

    [Fact]
    public async Task Trend_BucketsByCalendarMonth_ExcludingCancelled()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var (_, courseId, partId) = await AddExternalCourseAsync(ctx, "Tax", "TAX", 100000m);

        await AddSession(ctx, courseId, partId, new DateTime(2026, 1, 10, 9, 0, 0, DateTimeKind.Utc), 1000m);
        await AddSession(ctx, courseId, partId, new DateTime(2026, 2, 10, 9, 0, 0, DateTimeKind.Utc), 2000m);
        var cancelled = await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            courseId, partId, new DateTime(2026, 2, 20, 9, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 2, 20, 12, 0, 0, DateTimeKind.Utc), "Room", 20, null, null, "Ext", "ext@x.com",
            ExternalTrainerCost: 9999m), CancellationToken.None);
        await new CancelSessionCommandHandler(ctx).Handle(
            new CancelSessionCommand(cancelled.Value.SessionId, "x"), CancellationToken.None);

        var result = await new GetBudgetSpendTrendQueryHandler(ctx).Handle(
            new GetBudgetSpendTrendQuery(null, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var pts = result.Value!.Points;
        Assert.Equal(2, pts.Count);
        Assert.Equal(1, pts[0].Month);
        Assert.Equal(1000m, pts[0].Spend);
        Assert.Equal(2, pts[1].Month);
        Assert.Equal(2000m, pts[1].Spend);
    }

    [Fact]
    public async Task Detail_ReturnsRowsForServiceLine_OrderedByDateDesc()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var (slId, courseId, partId) = await AddExternalCourseAsync(ctx, "Tax", "TAX", 100000m);

        await AddSession(ctx, courseId, partId, new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc), 1000m);
        await AddSession(ctx, courseId, partId, new DateTime(2026, 6, 15, 9, 0, 0, DateTimeKind.Utc), 2500m);

        var result = await new GetBudgetSpendDetailQueryHandler(ctx).Handle(
            new GetBudgetSpendDetailQuery(slId, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.Equal(2, dto.Rows.Count);
        Assert.Equal(2500m, dto.Rows[0].Amount); // most recent first
        Assert.Equal(1000m, dto.Rows[1].Amount);
        Assert.Equal("Ext Trainer", dto.Rows[0].TrainerName);
    }
}
