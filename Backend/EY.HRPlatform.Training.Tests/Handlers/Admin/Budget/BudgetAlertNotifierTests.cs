using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Budget;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Budget;

public class BudgetAlertNotifierTests
{
    private static readonly DateTime Y2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2027 = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime InPeriod = new(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc);

    private sealed record Scenario(
        TrainingDbContext Ctx, Guid CourseId, Guid PartId, Guid ServiceLineId,
        RecordingBudgetAlertEmailSender Sender, IBudgetAlertNotifier Notifier);

    private static async Task<Scenario> SeedAsync(decimal allocated = 10000m, bool external = true)
    {
        var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var categoryId = ctx.Categories.First().Id;
        var sl = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        var course = new TrainingCourse(
            "OnSite course", null, 0, false, BadgeLevel.Bronze, categoryId, null,
            TrainingType.OnSite, null,
            external ? CostType.External : CostType.Internal,
            external ? sl.Id : null);
        ctx.Trainings.Add(course);
        await ctx.SaveChangesAsync();

        var partId = (await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(course.Id, "P1", null, 3m), CancellationToken.None)).Value;

        await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(sl.Id, "Annual", Y2026, Y2027, allocated), CancellationToken.None);

        var sender = new RecordingBudgetAlertEmailSender();
        var notifier = new BudgetAlertNotifier(ctx, sender, NullLogger<BudgetAlertNotifier>.Instance);
        return new Scenario(ctx, course.Id, partId, sl.Id, sender, notifier);
    }

    private static Task AddSession(Scenario s, decimal trainerCost, DateTime? start = null) =>
        new AddSessionCommandHandler(s.Ctx, s.Notifier).Handle(new AddSessionCommand(
            s.CourseId, s.PartId, start ?? InPeriod, (start ?? InPeriod).AddHours(3), "Room", 20,
            null, null, "Ext", "ext@x.com", ExternalTrainerCost: trainerCost), CancellationToken.None);

    [Fact]
    public async Task NoEmail_WhenBelowAllThresholds()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 5000m); // 50%
        Assert.Empty(s.Sender.Sent);
    }

    [Fact]
    public async Task Emails80_WhenCrossing80()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 8200m); // 82%
        Assert.Equal(80, Assert.Single(s.Sender.Sent).ThresholdPercent);
    }

    [Fact]
    public async Task Emails90_WhenCrossing90()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 9500m); // 95%
        Assert.Equal(90, Assert.Single(s.Sender.Sent).ThresholdPercent);
    }

    [Fact]
    public async Task Emails100_WhenCrossing100()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 10500m); // 105%
        Assert.Equal(100, Assert.Single(s.Sender.Sent).ThresholdPercent);
    }

    [Fact]
    public async Task EmailsOnce_HighestBand_WhenJumpingMultipleThresholds()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 12000m); // 0% -> 120%, crosses 80/90/100 in one save
        Assert.Single(s.Sender.Sent);
        Assert.Equal(100, s.Sender.Last!.ThresholdPercent);
    }

    [Fact]
    public async Task EmailsOnce_OnIncrementalCrossing()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 7000m, InPeriod);             // 70% — no cross
        await AddSession(s, 1500m, InPeriod.AddDays(1));  // 85% — crosses 80
        Assert.Equal(80, Assert.Single(s.Sender.Sent).ThresholdPercent);
    }

    [Fact]
    public async Task NoNewEmail_WhenSessionCancelled()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        var add = await new AddSessionCommandHandler(s.Ctx, s.Notifier).Handle(new AddSessionCommand(
            s.CourseId, s.PartId, InPeriod, InPeriod.AddHours(3), "Room", 20, null, null, "Ext", "ext@x.com",
            ExternalTrainerCost: 8500m), CancellationToken.None); // fires 80
        Assert.Single(s.Sender.Sent);

        await new CancelSessionCommandHandler(s.Ctx).Handle(
            new CancelSessionCommand(add.Value.SessionId, "x"), CancellationToken.None);

        Assert.Single(s.Sender.Sent); // cancellation lowers spend; no new alert
    }

    [Fact]
    public async Task NoEmail_WhenNoBudgetCoversSession()
    {
        var s = await SeedAsync();
        await using var _ = s.Ctx;
        await AddSession(s, 9999m, new DateTime(2028, 1, 1, 9, 0, 0, DateTimeKind.Utc)); // outside budget period
        Assert.Empty(s.Sender.Sent);
    }

    [Fact]
    public async Task NoEmail_ForInternalTraining()
    {
        var s = await SeedAsync(external: false);
        await using var _ = s.Ctx;
        await AddSession(s, 9999m);
        Assert.Empty(s.Sender.Sent);
    }

    [Fact]
    public async Task SaveSucceeds_WhenEmailSenderThrows()
    {
        var ctxScenario = await SeedAsync();
        await using var _ = ctxScenario.Ctx;
        var throwingNotifier = new BudgetAlertNotifier(
            ctxScenario.Ctx, new ThrowingBudgetAlertEmailSender(), NullLogger<BudgetAlertNotifier>.Instance);

        var add = await new AddSessionCommandHandler(ctxScenario.Ctx, throwingNotifier).Handle(new AddSessionCommand(
            ctxScenario.CourseId, ctxScenario.PartId, InPeriod, InPeriod.AddHours(3), "Room", 20,
            null, null, "Ext", "ext@x.com", ExternalTrainerCost: 9000m), CancellationToken.None);

        Assert.True(add.IsSuccess); // best-effort: a failing alert never breaks the save
    }
}
