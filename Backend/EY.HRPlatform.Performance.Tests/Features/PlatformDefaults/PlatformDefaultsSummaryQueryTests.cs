using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.PlatformDefaults;

public class PlatformDefaultsSummaryQueryTests
{
    [Fact]
    public async Task Summary_Uses_Applied_Defaults_And_Stays_Ready()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var appliedGuardrails = PlatformPerformanceGuardrails.CreateApplied(
            1, 10, 1, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(appliedGuardrails);

        var baseline = PlatformObjectiveBaseline.Create();
        baseline.Apply(7, "5,10,15,20,25,30,40,50", 10, "Optional", "Quantitative,Qualitative", true);
        db.PlatformObjectiveBaselines.Add(baseline);

        await db.SaveChangesAsync();

        var handler = new GetPlatformDefaultsSummaryQueryHandler(db);

        var result = await handler.Handle(new GetPlatformDefaultsSummaryQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value.AppliedGuardrails);
        Assert.NotNull(result.Value.AppliedBaseline);
        Assert.Equal("Ready for new tenants", result.Value.Status.Label);
    }
}
