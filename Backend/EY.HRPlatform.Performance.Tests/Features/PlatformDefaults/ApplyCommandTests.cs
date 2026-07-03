using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.PlatformDefaults;

/// <summary>
/// Atomic apply for platform defaults: blocked/failed apply changes nothing, guardrails stay a
/// single applied row, and baseline history remains immutable.
/// </summary>
public class ApplyCommandTests
{
    private static ApplyGuardrailsRequest LockedGuardrails(int maxWeightChoices = 10) =>
        new(1, 10, 1, 30, 0, maxWeightChoices, "Quantitative,Qualitative", 150, 500, 10);

    private static ApplyBaselineRequest LockedBaseline(
        int maxObjectives = 7, string weights = "5,10,15,20,25,30,40,50") =>
        new(maxObjectives, weights, 10, "Optional", "Quantitative,Qualitative", true);

    [Fact]
    public async Task ApplyGuardrails_Applies_When_Clean()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyGuardrailsCommandHandler(
            db, new ConfigurationAuditWriter(db), new GuardrailImpactAnalyzer(db, new PolicyValidator()));

        var result = await handler.Handle(new ApplyGuardrailsCommand(actor, LockedGuardrails()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Applied);
        Assert.NotNull(result.Value.Guardrails);
        Assert.Equal(1, db.PlatformPerformanceGuardrails.Count());
    }

    [Fact]
    public async Task ApplyGuardrails_Blocks_On_StandardSetup_Conflict_And_Persists_Nothing()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        // Applied limits allow 10 weight choices; standard setup uses 8 weight values.
        var guardrails = PlatformPerformanceGuardrails.CreateApplied(1, 10, 1, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = PlatformObjectiveBaseline.Create();
        baseline.Apply(7, "5,10,15,20,25,30,40,50", 10, "Optional", "Quantitative,Qualitative", true);
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyGuardrailsCommandHandler(
            db, new ConfigurationAuditWriter(db), new GuardrailImpactAnalyzer(db, new PolicyValidator()));

        // Lowering the weight-choice cap to 4 invalidates the 8-value standard setup.
        var result = await handler.Handle(new ApplyGuardrailsCommand(actor, LockedGuardrails(maxWeightChoices: 4)), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Applied);
        Assert.NotNull(result.Value.Impact);
        Assert.True(result.Value.Impact!.HasConflicts);
        Assert.NotEmpty(result.Value.Impact.StandardSetupConflicts);

        // Applied limits unchanged, and no extra guardrail row left behind.
        Assert.Equal(1, db.PlatformPerformanceGuardrails.Count());
        var applied = db.PlatformPerformanceGuardrails.Single();
        Assert.Equal(10, applied.MaxAllowedWeightingValues);
    }

    [Fact]
    public async Task ApplyBaseline_Publishes_New_Version_And_Supersedes_Prior()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var guardrails = PlatformPerformanceGuardrails.CreateApplied(1, 10, 1, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);

        var baseline = PlatformObjectiveBaseline.Create();
        baseline.Apply(4, "25,50", 5, "Optional", "Quantitative,Qualitative", true);
        db.PlatformObjectiveBaselines.Add(baseline);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyBaselineCommandHandler(db, new ConfigurationAuditWriter(db), new PolicyValidator());

        var result = await handler.Handle(new ApplyBaselineCommand(actor, LockedBaseline()), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Applied);
        Assert.Equal(7, result.Value.Baseline!.MaxObjectivesPerPlan);

        // New version applied, prior version superseded (history preserved).
        var versions = db.PlatformObjectiveBaselineVersions.ToList();
        Assert.Equal(1, versions.Count(v => v.Status == BaselineVersionStatus.Published));
        Assert.Equal(1, versions.Count(v => v.Status == BaselineVersionStatus.Superseded));
    }

    [Fact]
    public async Task ApplyBaseline_Rejects_Infeasible_Weights_And_Persists_Nothing()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var guardrails = PlatformPerformanceGuardrails.CreateApplied(1, 10, 1, 30, 0, 10, "Quantitative,Qualitative", 150, 500, 10);
        db.PlatformPerformanceGuardrails.Add(guardrails);
        await db.SaveChangesAsync();

        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyBaselineCommandHandler(db, new ConfigurationAuditWriter(db), new PolicyValidator());

        // {30,40} cannot total 100 within 2 objectives → infeasible.
        var result = await handler.Handle(
            new ApplyBaselineCommand(actor, LockedBaseline(maxObjectives: 2, weights: "30,40")),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Applied);
        Assert.NotEmpty(result.Value.Errors);
        Assert.Empty(db.PlatformObjectiveBaselineVersions.ToList());
    }
}
