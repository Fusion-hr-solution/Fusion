using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectivePolicy;

public class ObjectivePlanningConfigurationTests
{
    private static ApplyObjectivePlanningConfigurationRequest Request(
        int maxObjectiveCount = 5,
        string weights = "5,10,15,20,25,30,40,50",
        bool quantitative = true,
        bool qualitative = true)
        => new(maxObjectiveCount, weights, quantitative, qualitative, "Planning update");

    private static void SeedPlatformConfiguration(Performance.Infrastructure.Persistence.PerformanceDbContext db)
    {
        db.PlatformPerformanceGuardrails.Add(
            PlatformPerformanceGuardrails.CreateApplied(
                maxObjectivesPerPlan: 10,
                supportedAllowedWeightValues: "5,10,15,20,25,30,40,50",
                quantitativeAvailable: true,
                qualitativeAvailable: true));
    }

    [Fact]
    public async Task Apply_StoresTenantPlanningConfiguration_AndReplacesCurrent()
    {
        var tenantId = Guid.NewGuid();
        var databaseName = $"planning-apply-{Guid.NewGuid()}";
        uint expectedVersion;

        await using (var seedDb = PerformanceTestContext.Create(tenantId, out _, databaseName))
        {
            SeedPlatformConfiguration(seedDb);
            var config = global::EY.HRPlatform.Performance.Domain.Entities.TenantObjectivePolicy.Create(tenantId);
            var current = config.ApplyConfiguration(4, "25,50", "Quantitative,Qualitative", Guid.NewGuid(), "Seeder", null);
            seedDb.TenantObjectivePolicies.Add(config);
            await seedDb.SaveChangesAsync();
            expectedVersion = current.Version;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext, databaseName);
        var handler = new ApplyObjectivePlanningConfigurationCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyObjectivePlanningConfigurationCommand(
                new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Tenant Admin").Build(),
                Request(),
                expectedVersion),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Applied);
        Assert.NotNull(result.Value.Configuration);
        Assert.Equal(2, db.TenantObjectivePolicyVersions.Count());
        Assert.Contains(db.TenantObjectivePolicyVersions, v => v.Status == global::EY.HRPlatform.Performance.Domain.Entities.ObjectivePlanningConfigurationVersionStatus.Replaced);
        Assert.Contains(db.TenantObjectivePolicyVersions, v => v.Status == global::EY.HRPlatform.Performance.Domain.Entities.ObjectivePlanningConfigurationVersionStatus.Current);
        Assert.Equal("5,10,15,20,25,30,40,50", result.Value.Configuration!.AllowedWeights);
    }

    [Fact]
    public async Task Apply_RejectsTenantValuesOutsidePlatformLimits_WithoutPersisting()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedPlatformConfiguration(db);
        await db.SaveChangesAsync();

        var handler = new ApplyObjectivePlanningConfigurationCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyObjectivePlanningConfigurationCommand(
                new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Tenant Admin").Build(),
                Request(maxObjectiveCount: 11),
                0),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Applied);
        Assert.Null(result.Value.Configuration);
        Assert.Contains(result.Value.Errors, e => e.Contains("maximum objective", StringComparison.OrdinalIgnoreCase));
        Assert.False(await db.TenantObjectivePolicyVersions.AnyAsync());
    }

    [Fact]
    public async Task Apply_RejectsArbitraryTenantWeightValues_WithoutPersisting()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedPlatformConfiguration(db);
        await db.SaveChangesAsync();

        var handler = new ApplyObjectivePlanningConfigurationCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyObjectivePlanningConfigurationCommand(
                new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Tenant Admin").Build(),
                Request(weights: "5,10,17,20"),
                0),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Applied);
        Assert.Contains(result.Value.Errors, e => e.Contains("5% increments", StringComparison.OrdinalIgnoreCase));
        Assert.False(await db.TenantObjectivePolicyVersions.AnyAsync());
    }

    [Fact]
    public async Task Apply_RejectsStaleVersion_WithoutChangingCurrent()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        SeedPlatformConfiguration(db);
        var config = global::EY.HRPlatform.Performance.Domain.Entities.TenantObjectivePolicy.Create(tenantId);
        config.ApplyConfiguration(4, "25,50", "Quantitative,Qualitative", Guid.NewGuid(), "Seeder", null);
        db.TenantObjectivePolicies.Add(config);
        await db.SaveChangesAsync();

        var handler = new ApplyObjectivePlanningConfigurationCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new PerformanceConfigurationValidator());

        var result = await handler.Handle(
            new ApplyObjectivePlanningConfigurationCommand(
                new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).WithFullName("Tenant Admin").Build(),
                Request(maxObjectiveCount: 5),
                999),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ObjectivePlanningConfiguration.StaleApply", result.Error.Code);
        Assert.Single(db.TenantObjectivePolicyVersions);
        Assert.Equal(4, db.TenantObjectivePolicyVersions.Single().MaxObjectivesPerPlan);
    }

    [Fact]
    public async Task Get_ReturnsNotConfiguredWithoutCreatingRows()
    {
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        var handler = new GetObjectivePlanningConfigurationQueryHandler(db);

        var result = await handler.Handle(new GetObjectivePlanningConfigurationQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.IsConfigured);
        Assert.False(await db.TenantObjectivePolicies.AnyAsync());
        Assert.False(await db.PerformanceConfigurationAuditEntries.AnyAsync());
    }
}
