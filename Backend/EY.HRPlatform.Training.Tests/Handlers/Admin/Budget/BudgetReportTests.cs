using System.Text;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Budget.Export;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Features.Admin.Sessions.Commands;
using EY.HRPlatform.Training.Models.Responses;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Budget;

public class BudgetReportTests
{
    private static readonly DateTime Y2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Y2027 = new(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static BudgetReportDto Sample() => new()
    {
        PeriodLabel = "2026-01-01 to 2026-12-31",
        ServiceLineFilter = "Tax",
        TotalAllocated = 10000m,
        TotalSpent = 8500m,
        TotalRemaining = 1500m,
        PercentConsumed = 85m,
        ServiceLines =
        [
            new BudgetByServiceLineDto
            {
                ServiceLineName = "Tax", Color = "#10B981",
                Allocated = 10000m, Spent = 8500m, Remaining = 1500m, PercentConsumed = 85m,
            },
        ],
        Detail =
        [
            new BudgetReportDetailRowDto
            {
                ServiceLineName = "Tax", TrainingTitle = "Advanced Audit",
                StartUtc = new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc),
                Amount = 8500m, TrainerName = "Ext Trainer",
            },
        ],
    };

    [Fact]
    public void ToExcel_ProducesNonEmptyXlsx()
    {
        var bytes = new BudgetReportExporter().ToExcel(Sample());
        Assert.True(bytes.Length > 0);
        // .xlsx is a ZIP archive — starts with "PK".
        Assert.Equal((byte)'P', bytes[0]);
        Assert.Equal((byte)'K', bytes[1]);
    }

    [Fact]
    public void ToPdf_ProducesValidPdf()
    {
        var bytes = new BudgetReportExporter().ToPdf(Sample());
        Assert.True(bytes.Length > 0);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public async Task ExportQuery_ReturnsSummaryAndDetail_AndExportsCleanly()
    {
        await using var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var categoryId = ctx.Categories.First().Id;
        var sl = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        var course = new TrainingCourse("Ext", null, 0, false, BadgeLevel.Bronze, categoryId,
            null, TrainingType.OnSite, null, CostType.External, sl.Id);
        ctx.Trainings.Add(course);
        await ctx.SaveChangesAsync();

        var partId = (await new AddPartCommandHandler(ctx).Handle(
            new AddPartCommand(course.Id, "P1", null, 3m), CancellationToken.None)).Value;
        await new CreateTrainingBudgetCommandHandler(ctx).Handle(
            new CreateTrainingBudgetCommand(sl.Id, "Annual", Y2026, Y2027, 10000m), CancellationToken.None);
        await new AddSessionCommandHandler(ctx, new NoOpBudgetAlertNotifier()).Handle(new AddSessionCommand(
            course.Id, partId, new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc), "Room", 20, null, null, "Ext Trainer", "ext@x.com",
            ExternalTrainerCost: 8500m), CancellationToken.None);

        var result = await new GetBudgetReportForExportQueryHandler(ctx).Handle(
            new GetBudgetReportForExportQuery(null, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value!;
        Assert.Equal(10000m, dto.TotalAllocated);
        Assert.Equal(8500m, dto.TotalSpent);
        Assert.Equal("All service lines", dto.ServiceLineFilter);
        Assert.Equal("All time", dto.PeriodLabel);
        Assert.Single(dto.ServiceLines);
        var detailRow = Assert.Single(dto.Detail);
        Assert.Equal(8500m, detailRow.Amount);
        Assert.Equal("Ext Trainer", detailRow.TrainerName);

        var exporter = new BudgetReportExporter();
        Assert.True(exporter.ToExcel(dto).Length > 0);
        Assert.True(exporter.ToPdf(dto).Length > 0);
    }
}
