using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetDraftSetupReadiness;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSetup;

public class GetDraftSetupReadinessQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private const string SettingsJson = """{"orgUnitTypes":["Department","Team"]}""";

    [Fact]
    public async Task Handle_WithNoDraftUnits_ReturnsBlockingIssue()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetDraftSetupReadinessQueryHandler(context);

        var result = await handler.Handle(new GetDraftSetupReadinessQuery(), CancellationToken.None);

        Assert.False(result.IsReadyForApproval);
        Assert.Equal(0, result.TotalUnitCount);
        Assert.Equal(0, result.RootUnitCount);
        Assert.Equal(1, result.BlockingIssueCount);
        Assert.Equal("NO_UNITS", result.BlockingIssues[0].Code);
    }

    [Fact]
    public async Task Handle_WithMultipleValidRootUnits_ReturnsWarningButStaysReady()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            seedContext.DraftOrgUnits.AddRange(
                DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "department", null, null, null, null),
                DraftOrgUnit.Create(TenantId, "OPS", "Operations", "department", null, null, null, null));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetDraftSetupReadinessQueryHandler(context);

        var result = await handler.Handle(new GetDraftSetupReadinessQuery(), CancellationToken.None);

        Assert.True(result.IsReadyForApproval);
        Assert.Equal(2, result.TotalUnitCount);
        Assert.Equal(2, result.RootUnitCount);
        Assert.Equal(0, result.BlockingIssueCount);
        Assert.Equal(1, result.WarningCount);
        Assert.Equal("MULTIPLE_TOP_LEVEL_UNITS", result.Warnings[0].Code);
    }
}