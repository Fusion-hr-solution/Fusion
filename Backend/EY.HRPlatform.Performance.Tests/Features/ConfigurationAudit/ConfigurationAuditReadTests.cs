using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ConfigurationAudit.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.ConfigurationAudit;

/// <summary>
/// The configuration trail has been written since the configuration work landed and readable by
/// nobody. These cover the read path: paginated, tenant-isolated, scope-gated, and append-only.
/// </summary>
public sealed class ConfigurationAuditReadTests
{
    private static async Task<(Guid TenantA, Guid TenantB, string DbName)> SeedAsync(
        int tenantAEntries = 3, int tenantBEntries = 2, int platformEntries = 2)
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"config-audit-{Guid.NewGuid()}";

        await using (var db = PerformanceTestContext.Create(tenantA, out _, dbName))
        {
            var writer = new ConfigurationAuditWriter(db);
            for (var i = 0; i < tenantAEntries; i++)
            {
                await writer.AppendTenantAsync(
                    tenantA, Guid.NewGuid(), "HR Admin", $"TenantChange{i}",
                    "ObjectivePlanningConfiguration", Guid.NewGuid(),
                    cancellationToken: CancellationToken.None);
            }

            for (var i = 0; i < platformEntries; i++)
            {
                await writer.AppendPlatformAsync(
                    Guid.NewGuid(), "Platform Admin", $"PlatformChange{i}",
                    "PlatformGuardrails", Guid.NewGuid(),
                    cancellationToken: CancellationToken.None);
            }

            await db.SaveChangesAsync();
        }

        await using (var db = PerformanceTestContext.Create(tenantB, out _, dbName))
        {
            var writer = new ConfigurationAuditWriter(db);
            for (var i = 0; i < tenantBEntries; i++)
            {
                await writer.AppendTenantAsync(
                    tenantB, Guid.NewGuid(), "Other HR", $"OtherTenantChange{i}",
                    "ObjectivePlanningConfiguration", Guid.NewGuid(),
                    cancellationToken: CancellationToken.None);
            }

            await db.SaveChangesAsync();
        }

        return (tenantA, tenantB, dbName);
    }

    private static async Task<Performance.Models.Responses.PagedResponse<ConfigurationAuditEntryDto>> ReadAsync(
        Guid tenantId, string dbName, bool includePlatform, int? page = null, int? pageSize = null)
    {
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var result = await new GetConfigurationAuditQueryHandler(db, tenant).Handle(
            new GetConfigurationAuditQuery(includePlatform, page, pageSize), CancellationToken.None);

        Assert.True(result.IsSuccess);
        return result.Value;
    }

    [Fact]
    public async Task A_tenant_administrator_sees_only_their_own_tenants_entries()
    {
        var seeded = await SeedAsync();

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: false);

        Assert.Equal(3, page.TotalCount);
        Assert.All(page.Items, entry => Assert.Equal("Tenant", entry.Scope));
    }

    [Fact]
    public async Task Platform_entries_are_withheld_from_a_tenant_administrator()
    {
        var seeded = await SeedAsync();

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: false);

        Assert.DoesNotContain(page.Items, entry => entry.Scope == "Platform");
    }

    [Fact]
    public async Task A_platform_administrator_sees_platform_entries_alongside_the_tenants_own()
    {
        var seeded = await SeedAsync();

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: true);

        Assert.Equal(5, page.TotalCount);
        Assert.Contains(page.Items, entry => entry.Scope == "Platform");
        Assert.Contains(page.Items, entry => entry.Scope == "Tenant");
    }

    [Fact]
    public async Task Another_tenants_entries_are_never_visible_even_to_a_platform_administrator()
    {
        var seeded = await SeedAsync();

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: true);

        Assert.DoesNotContain(page.Items, entry => entry.Action.StartsWith("OtherTenantChange"));
    }

    [Fact]
    public async Task The_read_is_paginated_and_reports_the_true_total()
    {
        var seeded = await SeedAsync(tenantAEntries: 12);

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: false, page: 1, pageSize: 5);

        Assert.Equal(5, page.Items.Count);
        Assert.Equal(12, page.TotalCount);
        Assert.True(page.HasNextPage);
    }

    [Fact]
    public async Task An_oversized_page_size_is_clamped_rather_than_rejected()
    {
        var seeded = await SeedAsync(tenantAEntries: 4);

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: false, page: 1, pageSize: 10_000);

        Assert.Equal(Performance.Features.Shared.HistoryPage.MaxPageSize, page.PageSize);
        Assert.Equal(4, page.Items.Count);
    }

    [Fact]
    public async Task Entries_are_most_recent_first()
    {
        var seeded = await SeedAsync(tenantAEntries: 5);

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: false);

        var timestamps = page.Items.Select(entry => entry.OccurredAt).ToList();
        Assert.Equal(timestamps.OrderByDescending(value => value), timestamps);
    }

    [Fact]
    public async Task The_trail_is_append_only_by_construction()
    {
        var seeded = await SeedAsync(tenantAEntries: 2);

        // Every mapped property is privately settable, so an entry cannot be rewritten through the
        // model at all — the trail is append-only by construction rather than by convention.
        var settable = typeof(Performance.Domain.Entities.PerformanceConfigurationAuditEntry)
            .GetProperties()
            .Where(property => property.SetMethod?.IsPublic == true)
            .Select(property => property.Name)
            .ToList();

        Assert.Empty(settable);

        var page = await ReadAsync(seeded.TenantA, seeded.DbName, includePlatform: false);
        Assert.Equal(2, page.TotalCount);
    }
}
