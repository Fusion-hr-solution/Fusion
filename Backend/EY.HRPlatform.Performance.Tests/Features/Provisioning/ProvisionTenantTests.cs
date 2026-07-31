using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.Provisioning;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Provisioning;

public class ProvisionTenantTests
{
    private static ProvisionTenantCommandHandler CreateHandler(
        global::EY.HRPlatform.Performance.Infrastructure.Persistence.PerformanceDbContext db)
        => new(db, new TenantContext(), new ConfigurationAuditWriter(db));

    private static ApplyPlatformPerformanceConfigurationRequest PlatformRequest(
        int startingMaxObjectiveCount,
        string startingWeights,
        bool startingQuantitative = true,
        bool startingQualitative = true)
        => new(
            10,
            "5,10,15,20,25,30,40,50",
            true,
            true,
            startingMaxObjectiveCount,
            startingWeights,
            startingQuantitative,
            startingQualitative);

    private static PlatformObjectiveBaseline CreateStartingConfiguration(
        int maxObjectiveCount = 4,
        string weights = "25,50",
        string measurementTypes = "Quantitative,Qualitative")
    {
        var startingConfiguration = PlatformObjectiveBaseline.Create();
        startingConfiguration.Apply(maxObjectiveCount, weights, measurementTypes);
        return startingConfiguration;
    }

    [Fact]
    public async Task Provision_CreatesPlanningConfiguration_FromCurrentStartingConfiguration()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        db.PlatformPerformanceGuardrails.Add(
            PlatformPerformanceGuardrails.CreateApplied(10, "5,10,15,20,25,30,40,50", true, true));
        db.PlatformObjectiveBaselines.Add(CreateStartingConfiguration());
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.WasAlreadyProvisioned);

        var configuration = await db.TenantObjectivePolicies
            .IgnoreQueryFilters()
            .Include(p => p.Versions)
            .SingleAsync(p => p.TenantId == tenantId);

        Assert.Single(configuration.Versions);
        Assert.Equal(4, configuration.Versions[0].MaxObjectivesPerPlan);
        Assert.Equal("25,50", configuration.Versions[0].AllowedWeightValues);
        Assert.Equal("Quantitative,Qualitative", configuration.Versions[0].MeasurementTypes);
        Assert.Equal(configuration.Versions[0].Id, result.Value.ConfigurationVersionId);
    }

    [Fact]
    public async Task Provision_IsIdempotent_WhenTenantAlreadyHasConfiguration()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);
        db.PlatformPerformanceGuardrails.Add(
            PlatformPerformanceGuardrails.CreateApplied(10, "5,10,15,20,25,30,40,50", true, true));
        db.PlatformObjectiveBaselines.Add(CreateStartingConfiguration());
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);

        var first = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);
        var second = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.False(first.Value.WasAlreadyProvisioned);
        Assert.True(second.Value.WasAlreadyProvisioned);
        Assert.Equal(first.Value.PolicyId, second.Value.PolicyId);

        var configurationCount = await db.TenantObjectivePolicies
            .IgnoreQueryFilters()
            .CountAsync(p => p.TenantId == tenantId);
        var versionCount = await db.TenantObjectivePolicyVersions
            .IgnoreQueryFilters()
            .CountAsync(v => v.TenantId == tenantId);

        Assert.Equal(1, configurationCount);
        Assert.Equal(1, versionCount);
    }

    [Fact]
    public async Task Provision_Fails_WhenNoStartingConfigurationExists()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var handler = CreateHandler(db);
        var result = await handler.Handle(new ProvisionTenantCommand(tenantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Provisioning.NoStartingConfiguration", result.Error.Code);
        Assert.False(await db.TenantObjectivePolicies.IgnoreQueryFilters().AnyAsync(p => p.TenantId == tenantId));
    }

    [Fact]
    public async Task ExistingTenantsRemainIndependent_WhenStartingConfigurationChanges()
    {
        var existingTenantId = Guid.NewGuid();
        var newTenantId = Guid.NewGuid();
        var databaseName = $"provision-independent-{Guid.NewGuid()}";

        uint platformVersion;
        await using (var seedDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, databaseName))
        {
            var handler = new ApplyPlatformPerformanceConfigurationCommandHandler(
                seedDb,
                new ConfigurationAuditWriter(seedDb),
                new PerformanceConfigurationValidator());
            var applied = await handler.Handle(
                new ApplyPlatformPerformanceConfigurationCommand(
                    new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build(),
                    PlatformRequest(4, "25,50"),
                    null),
                CancellationToken.None);
            Assert.True(applied.IsSuccess);
            platformVersion = applied.Value.Configuration!.Version;
        }

        await using (var firstDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, databaseName))
        {
            var handler = CreateHandler(firstDb);
            var existing = await handler.Handle(new ProvisionTenantCommand(existingTenantId), CancellationToken.None);
            Assert.True(existing.IsSuccess);
        }

        await using (var platformDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, databaseName))
        {
            var handler = new ApplyPlatformPerformanceConfigurationCommandHandler(
                platformDb,
                new ConfigurationAuditWriter(platformDb),
                new PerformanceConfigurationValidator());
            var applied = await handler.Handle(
                new ApplyPlatformPerformanceConfigurationCommand(
                    new ClaimsPrincipalBuilder().WithUserId(Guid.NewGuid()).Build(),
                    PlatformRequest(5, "10,20,30,40,50", startingQualitative: false),
                    platformVersion),
                CancellationToken.None);
            Assert.True(applied.IsSuccess);
            Assert.True(applied.Value.Applied);
        }

        await using (var nextDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, databaseName))
        {
            var handler = CreateHandler(nextDb);
            var next = await handler.Handle(new ProvisionTenantCommand(newTenantId), CancellationToken.None);
            Assert.True(next.IsSuccess);
        }

        await using var verifyDb = PerformanceTestContext.Create(Guid.NewGuid(), out _, databaseName);
        var existingConfiguration = await verifyDb.TenantObjectivePolicyVersions
            .IgnoreQueryFilters()
            .SingleAsync(v => v.TenantId == existingTenantId);
        var newConfiguration = await verifyDb.TenantObjectivePolicyVersions
            .IgnoreQueryFilters()
            .SingleAsync(v => v.TenantId == newTenantId);

        Assert.Equal(4, existingConfiguration.MaxObjectivesPerPlan);
        Assert.Equal("25,50", existingConfiguration.AllowedWeightValues);
        Assert.Equal("Quantitative,Qualitative", existingConfiguration.MeasurementTypes);
        Assert.Equal(5, newConfiguration.MaxObjectivesPerPlan);
        Assert.Equal("10,20,30,40,50", newConfiguration.AllowedWeightValues);
        Assert.Equal("Quantitative", newConfiguration.MeasurementTypes);
    }
}
