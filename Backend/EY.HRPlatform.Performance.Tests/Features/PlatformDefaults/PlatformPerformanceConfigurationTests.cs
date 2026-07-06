using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.PlatformDefaults;

public class PlatformPerformanceConfigurationTests
{
    private static ApplyPlatformPerformanceConfigurationRequest ValidRequest(
        int maxObjectiveCountLimit = 10,
        string supportedWeights = "5,10,15,20,25,30,40,50",
        int startingMaxObjectiveCount = 5,
        string startingWeights = "5,10,15,20,25,30,40,50",
        bool quantitativeAvailable = true,
        bool qualitativeAvailable = true,
        bool startingQuantitative = true,
        bool startingQualitative = true)
        => new(
            maxObjectiveCountLimit,
            supportedWeights,
            quantitativeAvailable,
            qualitativeAvailable,
            startingMaxObjectiveCount,
            startingWeights,
            startingQuantitative,
            startingQualitative);

    [Fact]
    public async Task Apply_StoresLeanPlatformConfiguration_AndAuditFacts()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var actorId = Guid.NewGuid();
        var actor = new ClaimsPrincipalBuilder()
            .WithUserId(actorId)
            .WithFullName("Platform Admin")
            .Build();
        var handler = new ApplyPlatformPerformanceConfigurationCommandHandler(
            db,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyPlatformPerformanceConfigurationCommand(actor, ValidRequest(), null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Applied);
        Assert.NotNull(result.Value.Configuration);
        Assert.Equal(10, result.Value.Configuration!.MaxObjectiveCountLimit);
        Assert.Equal("5,10,15,20,25,30,40,50", result.Value.Configuration.SupportedAllowedWeights);
        Assert.True(result.Value.Configuration.QuantitativeAvailable);
        Assert.True(result.Value.Configuration.QualitativeAvailable);
        Assert.Equal(5, result.Value.Configuration.StartingConfiguration.MaxObjectiveCount);
        Assert.Equal("5,10,15,20,25,30,40,50", result.Value.Configuration.StartingConfiguration.AllowedWeights);

        var audit = await db.PerformanceConfigurationAuditEntries.SingleAsync();
        Assert.Equal("PlatformConfigurationApplied", audit.Action);
        Assert.Equal(actorId, audit.ActorUserId);
        Assert.Equal("Platform", audit.Scope);
    }

    [Fact]
    public async Task Apply_RejectsArbitraryWeightValues_WithoutPersisting()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyPlatformPerformanceConfigurationCommandHandler(
            db,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyPlatformPerformanceConfigurationCommand(
                actor,
                ValidRequest(supportedWeights: "5,10,17,20", startingWeights: "5,10,17,20"),
                null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Applied);
        Assert.Null(result.Value.Configuration);
        Assert.Contains(result.Value.Errors, e => e.Contains("5% increments", StringComparison.OrdinalIgnoreCase));
        Assert.False(await db.PlatformPerformanceGuardrails.AnyAsync());
    }

    [Fact]
    public async Task Apply_RejectsStartingWeightsThatCannotMakeOneHundred_WithoutPersisting()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyPlatformPerformanceConfigurationCommandHandler(
            db,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyPlatformPerformanceConfigurationCommand(
                actor,
                ValidRequest(startingMaxObjectiveCount: 2, startingWeights: "30,40"),
                null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Applied);
        Assert.Contains(result.Value.Errors, e => e.Contains("100%", StringComparison.OrdinalIgnoreCase));
        Assert.False(await db.PlatformPerformanceGuardrails.AnyAsync());
        Assert.False(await db.PlatformObjectiveBaselines.AnyAsync());
    }

    [Fact]
    public async Task Apply_BlocksWhenExistingTenantConfigurationExceedsNewPlatformLimits()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out var tenantContext);
        var actor = new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build();
        var handler = new ApplyPlatformPerformanceConfigurationCommandHandler(
            db,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var initial = await handler.Handle(
            new ApplyPlatformPerformanceConfigurationCommand(actor, ValidRequest(), null),
            CancellationToken.None);
        Assert.True(initial.IsSuccess);

        var tenantId = Guid.NewGuid();
        var policy = global::EY.HRPlatform.Performance.Domain.Entities.TenantObjectivePolicy.Create(tenantId);
        policy.ApplyConfiguration(
            8,
            "25,50",
            "Quantitative,Qualitative",
            Guid.NewGuid(),
            "Tenant Admin",
            "Seed tenant configuration");
        db.TenantObjectivePolicies.Add(policy);
        await db.SaveChangesAsync();

        var blocked = await handler.Handle(
            new ApplyPlatformPerformanceConfigurationCommand(
                actor,
                ValidRequest(maxObjectiveCountLimit: 6, startingMaxObjectiveCount: 5),
                initial.Value.Configuration!.Version),
            CancellationToken.None);

        Assert.True(blocked.IsSuccess);
        Assert.False(blocked.Value.Applied);
        Assert.NotNull(blocked.Value.Impact);
        Assert.Equal(1, blocked.Value.Impact!.AffectedTenantConfigurationCount);
        Assert.Equal(10, (await db.PlatformPerformanceGuardrails.SingleAsync()).MaxObjectivesPerPlan);
    }

    [Fact]
    public async Task Get_DoesNotInitializeConfigurationOrAuditRows()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var handler = new GetPlatformPerformanceConfigurationQueryHandler(db);

        var result = await handler.Handle(new GetPlatformPerformanceConfigurationQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.Configuration);
        Assert.False(await db.PlatformPerformanceGuardrails.AnyAsync());
        Assert.False(await db.PlatformObjectiveBaselines.AnyAsync());
        Assert.False(await db.PerformanceConfigurationAuditEntries.AnyAsync());
    }
}
