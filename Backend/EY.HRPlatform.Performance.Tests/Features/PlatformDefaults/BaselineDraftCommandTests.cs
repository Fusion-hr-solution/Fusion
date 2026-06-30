using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.PlatformDefaults;

public class BaselineDraftCommandTests
{
    [Fact]
    public async Task Publish_Blocks_Invalid_Baseline_Draft()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var guardrails = PlatformPerformanceGuardrails.CreateDraft(1, 10, 0, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10, true);
        guardrails.Publish();
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = PlatformObjectiveBaseline.Create();
        baseline.CreateDraft(2, "30,40", 5, "Optional", "Quantitative,Qualitative", true);
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new PublishBaselineCommandHandler(db, new ConfigurationAuditWriter(db), new PolicyValidator());

        var result = await handler.Handle(new PublishBaselineCommand(actor), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("PlatformBaseline.ValidationFailed", result.Error.Code);
    }

    [Fact]
    public async Task Update_Baseline_Draft_Modifies_Existing_Draft()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var baseline = PlatformObjectiveBaseline.Create();
        baseline.CreateDraft(5, "10,20,25,50,100", 5, "Optional", "Quantitative,Qualitative", true);
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new UpdateBaselineDraftCommandHandler(db, new ConfigurationAuditWriter(db));

        var result = await handler.Handle(
            new UpdateBaselineDraftCommand(
                actor,
                new CreateBaselineDraftRequest(7, "10,20,30,40,50", 7, "Required", "Quantitative,Qualitative", false)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(7, result.Value.MaxObjectivesPerPlan);
        Assert.Equal("Required", result.Value.CascadeMode);
        Assert.False(result.Value.AttachmentsEnabled);
    }
}
