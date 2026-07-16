using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

/// <summary>
/// There is deliberately no read API for <see cref="WorkforceAuditEntry"/> in this milestone
/// (writing only — see audit spec task 3.4). These tests pin the invariant that the entity is
/// fail-closed tenant-scoped, so that any future read surface inherits tenant isolation by default
/// and a missing tenant context returns nothing rather than leaking cross-tenant audit history.
/// Deny-by-default authorization is enforced at the controller when/if such a surface is added.
/// </summary>
public class WorkforceAuditTenantIsolationTests
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    private static WorkforceAuditEntry Entry(Guid tenant)
        => WorkforceAuditEntry.Record(
            tenant, "Employment", Guid.NewGuid(),
            WorkforceAuditAction.EmploymentStarted, WorkforceSourceType.Manual);

    [Fact]
    public async Task AuditRead_ReturnsOnlyCurrentTenantEntries()
    {
        var dbName = Guid.NewGuid().ToString();
        await using (var seed = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seed.WorkforceAuditEntries.AddRange(Entry(TenantA), Entry(TenantA), Entry(TenantB));
            await seed.SaveChangesAsync();
        }

        await using var scoped = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantA), dbName);
        var entries = await scoped.WorkforceAuditEntries.ToListAsync();

        Assert.Equal(2, entries.Count);
        Assert.All(entries, e => Assert.Equal(TenantA, e.TenantId));
    }

    [Fact]
    public async Task AuditRead_WithUnresolvedTenant_ReturnsNothing()
    {
        var dbName = Guid.NewGuid().ToString();
        await using (var seed = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seed.WorkforceAuditEntries.AddRange(Entry(TenantA), Entry(TenantB));
            await seed.SaveChangesAsync();
        }

        await using var unresolved = TestDbContextFactory.Create(TestTenantContext.Unresolved(), dbName);
        var entries = await unresolved.WorkforceAuditEntries.ToListAsync();

        Assert.Empty(entries);
    }
}
