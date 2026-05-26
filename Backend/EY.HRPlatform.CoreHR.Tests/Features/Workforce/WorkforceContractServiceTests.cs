using System.Security.Claims;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public class WorkforceContractServiceTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private const string SettingsJson = """{"employeeFieldConfig":{"jobTitle":{"visible":true,"required":false,"visibleToEmployee":true,"visibleToManager":true}},"orgUnitTypes":["Department","Team"]}""";

    [Fact]
    public async Task GetEmployeeAsync_ManagerCanReadDirectReportButNotPeer()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid managerId;
        Guid directReportId;
        Guid peerId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, jobTitle: "Manager", employeeNumber: "E-100");
            var otherManager = Employee.Create(TenantId, "Jamie", "Leader", "jamie.leader@example.com", DateTime.UtcNow, jobTitle: "Manager", employeeNumber: "E-101");
            var directReport = Employee.Create(TenantId, "Casey", "Report", "casey.report@example.com", DateTime.UtcNow, jobTitle: "Analyst", employeeNumber: "E-102");
            var peer = Employee.Create(TenantId, "Morgan", "Peer", "morgan.peer@example.com", DateTime.UtcNow, jobTitle: "Analyst", employeeNumber: "E-103");

            directReport.AssignManager(manager.Id);
            peer.AssignManager(otherManager.Id);

            seedContext.Employees.AddRange(manager, otherManager, directReport, peer);
            await seedContext.SaveChangesAsync();

            managerId = manager.Id;
            directReportId = directReport.Id;
            peerId = peer.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = CreateService(context, tenantContext);
        var managerPrincipal = CreatePrincipal(Guid.NewGuid(), PlatformRole.Manager, managerId);

        var visibleDirectReport = await service.GetEmployeeAsync(directReportId, managerPrincipal, CancellationToken.None);
        var hiddenPeer = await service.GetEmployeeAsync(peerId, managerPrincipal, CancellationToken.None);

        Assert.NotNull(visibleDirectReport);
        Assert.Equal("E-102", visibleDirectReport!.EmployeeNumber);
        Assert.Null(hiddenPeer);
    }

    [Fact]
    public async Task GetPublishedOrgUnitsAsync_ReturnsStableKeysPathsAndPublishedVersion()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var state = TenantSetupState.CreateActivated(TenantId);
            state.Approve(Guid.NewGuid(), "Approver", PlatformRole.HRAdmin, false);
            state.Publish();
            state.Complete();
            seedContext.TenantSetupStates.Add(state);

            var root = OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            seedContext.OrgUnits.Add(root);
            await seedContext.SaveChangesAsync();

            var child = OrgUnit.Create(TenantId, "ENG-PLT", "Platform Team", "Team", root.Id);
            seedContext.OrgUnits.Add(child);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = CreateService(context, tenantContext);

        var orgUnits = await service.GetPublishedOrgUnitsAsync(false, CancellationToken.None);

        Assert.Equal(2, orgUnits.Count);
        var platformTeam = orgUnits.Single(unit => unit.StableKey == "ENG-PLT");
        Assert.Equal("ENG", platformTeam.ParentStableKey);
        Assert.Equal("Engineering / Platform Team", platformTeam.Path);
        Assert.Equal(1, platformTeam.PublishedStructureVersion);
    }

    private static WorkforceContractService CreateService(CoreHRDbContext context, TestTenantContext tenantContext)
        => new(
            context,
            tenantContext,
            new TenantSettingsReadService(context),
            new EmployeeReadModelPolicy());

    private static ClaimsPrincipal CreatePrincipal(Guid userId, string role, Guid? employeeId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role),
            new(CustomClaimTypes.FullName, "Test User")
        };

        if (employeeId.HasValue)
        {
            claims.Add(new Claim(CustomClaimTypes.EmployeeId, employeeId.Value.ToString()));
        }

        foreach (var grant in BuildRoleGrants(role))
        {
            claims.Add(new Claim(
                CustomClaimTypes.CorePermission,
                CorePermissionClaimValue.Encode(grant.PermissionKey, grant.Scope)));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role));
    }

    private static IEnumerable<EffectivePermissionGrant> BuildRoleGrants(string role)
        => role switch
        {
            PlatformRole.HRAdmin =>
            [
                new EffectivePermissionGrant(CorePermissions.EmployeeView, PermissionScopes.Tenant),
                new EffectivePermissionGrant(CorePermissions.EmployeeManage, PermissionScopes.Tenant),
                new EffectivePermissionGrant(CorePermissions.StructureView, PermissionScopes.Tenant),
                new EffectivePermissionGrant(CorePermissions.StructureManage, PermissionScopes.Tenant),
                new EffectivePermissionGrant(CorePermissions.SetupView, PermissionScopes.Tenant),
                new EffectivePermissionGrant(CorePermissions.SetupManage, PermissionScopes.Tenant),
                new EffectivePermissionGrant(CorePermissions.ProfileSelfView, PermissionScopes.Self),
                new EffectivePermissionGrant(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
                new EffectivePermissionGrant(CorePermissions.TeamView, PermissionScopes.DirectReports),
            ],
            PlatformRole.Manager =>
            [
                new EffectivePermissionGrant(CorePermissions.ProfileSelfView, PermissionScopes.Self),
                new EffectivePermissionGrant(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
                new EffectivePermissionGrant(CorePermissions.TeamView, PermissionScopes.DirectReports),
                new EffectivePermissionGrant(CorePermissions.EmployeeView, PermissionScopes.DirectReports),
            ],
            PlatformRole.Employee =>
            [
                new EffectivePermissionGrant(CorePermissions.ProfileSelfView, PermissionScopes.Self),
                new EffectivePermissionGrant(CorePermissions.ProfileSelfUpdate, PermissionScopes.Self),
            ],
            _ => [],
        };
}
