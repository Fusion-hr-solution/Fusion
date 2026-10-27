using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.AccessProfiles;

/// <summary>
/// B-094 C-4: everyone sees the whole org chart by default. The built-in Employee and Manager roles carry
/// <c>core.orgchart.view</c> at Tenant scope, and existing tenants gain it through the startup profile sync
/// without custom roles being touched.
/// </summary>
public sealed class OrgChartDefaultGrantTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _databases.DisposeAsync();

    [Fact]
    public void Employee_and_manager_roles_see_the_whole_org_chart()
    {
        foreach (var template in new[] { AccessProfileTemplates.Employee, AccessProfileTemplates.Manager })
        {
            Assert.Contains(template.Grants, grant => grant.PermissionKey == CorePermissions.OrgChartView
                && grant.Scope == PermissionScopes.Tenant);
        }
    }

    [SkippableFact]
    public async Task The_startup_sync_adds_the_grant_to_existing_built_in_roles_and_leaves_custom_roles_alone()
    {
        Skip.IfNot(_databases.Available, "No PostgreSQL connection configured.");
        await using var db = await _databases.CreateAsync("fusion_orgchart_grant");

        var tenantId = await SeedTenantAsync(db, "Atlas Group");
        var employee = AccessProfile.Create(tenantId, AccessProfileTemplates.Employee.Name, AccessProfileTemplates.Employee.Description,
            AccessProfileTypes.SystemSeeded, isSystemProtected: true, AccessProfileTemplates.Employee.InternalKey);
        employee.ReplaceGrants([
            AccessProfileGrant.Create(tenantId, employee.Id, CorePermissions.ProfileSelfView, PermissionScopes.Self),
            AccessProfileGrant.Create(tenantId, employee.Id, CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
            AccessProfileGrant.Create(tenantId, employee.Id, CorePermissions.EmployeeView, PermissionScopes.Self),
        ]);
        var custom = AccessProfile.Create(tenantId, "Contractor", null, AccessProfileTypes.Custom, isSystemProtected: false);
        custom.ReplaceGrants([AccessProfileGrant.Create(tenantId, custom.Id, CorePermissions.ProfileSelfView, PermissionScopes.Self)]);
        db.AccessProfiles.AddRange(employee, custom);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        await new AccessProfileService(db, RelationalTestDatabase.CreateUserManager(db)).EnsureSeedDataAsync();
        db.ChangeTracker.Clear();

        Assert.Contains(await GrantsAsync(db, employee.Id), grant => grant == $"{CorePermissions.OrgChartView}:{PermissionScopes.Tenant}");
        var manager = await db.AccessProfiles.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(profile => profile.TenantId == tenantId && profile.InternalKey == AccessProfileTemplates.Manager.InternalKey);
        Assert.Contains(await GrantsAsync(db, manager.Id), grant => grant == $"{CorePermissions.OrgChartView}:{PermissionScopes.Tenant}");
        Assert.Equal([$"{CorePermissions.ProfileSelfView}:{PermissionScopes.Self}"], await GrantsAsync(db, custom.Id));
    }

    private static async Task<List<string>> GrantsAsync(AppIdentityDbContext db, Guid profileId)
        => await db.Set<AccessProfileGrant>().IgnoreQueryFilters().AsNoTracking()
            .Where(grant => grant.AccessProfileId == profileId)
            .Select(grant => grant.PermissionKey + ":" + grant.Scope)
            .ToListAsync();

    private static async Task<Guid> SeedTenantAsync(AppIdentityDbContext db, string name)
    {
        var id = Guid.NewGuid();
        await db.Database.ExecuteSqlRawAsync($"""
            INSERT INTO identity."Tenants"
                ("Id","Name","Slug","IsActive","IsArchived","CreatedAt","AdministratorActivationStatus","Locale","TimeZone")
            VALUES ('{id}','{name}','tenant-{id:N}',true,false,now(),'Active','en-US','Africa/Tunis');
            """);
        return id;
    }
}
