using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ConfigurationAudit;

public class ConfigurationAuditAppendOnlyTests
{
    private static PerformanceConfigurationAuditEntry SeedEntry(Guid tenantId)
        => PerformanceConfigurationAuditEntry.CreateTenant(
            tenantId,
            actorUserId: Guid.NewGuid(),
            actorName: "Test Actor",
            action: "PolicyApplied",
            entityType: "TenantObjectivePolicy",
            entityId: Guid.NewGuid(),
            versionNumber: 1);

    [Fact]
    public async Task Appending_A_Lifecycle_Record_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        db.PerformanceConfigurationAuditEntries.Add(SeedEntry(tenantId));

        var written = await db.SaveChangesAsync();

        Assert.Equal(1, written);
    }

    [Fact]
    public async Task Modifying_A_Lifecycle_Record_Is_Rejected()
    {
        var dbName = $"audit-append-only-{Guid.NewGuid()}";
        var tenantId = Guid.NewGuid();

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            seed.PerformanceConfigurationAuditEntries.Add(SeedEntry(tenantId));
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var entry = db.PerformanceConfigurationAuditEntries.Single();
        db.Entry(entry).Property(nameof(PerformanceConfigurationAuditEntry.Reason)).CurrentValue = "tampered";

        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Deleting_A_Lifecycle_Record_Is_Rejected()
    {
        var dbName = $"audit-append-only-{Guid.NewGuid()}";
        var tenantId = Guid.NewGuid();

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            seed.PerformanceConfigurationAuditEntries.Add(SeedEntry(tenantId));
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var entry = db.PerformanceConfigurationAuditEntries.Single();
        db.PerformanceConfigurationAuditEntries.Remove(entry);

        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }
}
