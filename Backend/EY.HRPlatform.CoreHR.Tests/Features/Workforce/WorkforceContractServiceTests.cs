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

    [Fact]
    public async Task GetAccessRosterSummaryAsync_ReturnsTenantHeadcountBreakdown()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var activeEmployee = Employee.Create(
                TenantId,
                "Alex",
                "Active",
                "alex.active@example.com",
                DateTime.UtcNow,
                jobTitle: "Analyst",
                employeeNumber: "E-200");
            var inactiveEmployee = Employee.Create(
                TenantId,
                "Iris",
                "Inactive",
                "iris.inactive@example.com",
                DateTime.UtcNow,
                jobTitle: "Analyst",
                employeeNumber: "E-201");
            inactiveEmployee.Deactivate();

            seedContext.Employees.AddRange(activeEmployee, inactiveEmployee);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = CreateService(context, tenantContext);

        var summary = await service.GetAccessRosterSummaryAsync(CancellationToken.None);

        Assert.Equal(2, summary.TotalCount);
        Assert.Equal(1, summary.ActiveEmployeeCount);
        Assert.Equal(1, summary.InactiveEmployeeCount);
    }

    [Fact]
    public async Task SearchAccessSubjectsAsync_UsesOperationalStateLabelsAndInviteCopy()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid notInvitedId;
        Guid pendingId;
        Guid activeId;
        var inviteCreatedAt = new DateTime(2026, 6, 6, 10, 0, 0, DateTimeKind.Utc);
        var lastLoginAt = new DateTime(2026, 6, 7, 8, 30, 0, DateTimeKind.Utc);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var notInvited = Employee.Create(
                TenantId,
                "Alex",
                "Ready",
                "alex.ready@example.com",
                DateTime.UtcNow,
                jobTitle: "Analyst",
                employeeNumber: "E-300");
            var pending = Employee.Create(
                TenantId,
                "Blair",
                "Pending",
                "blair.pending@example.com",
                DateTime.UtcNow,
                jobTitle: "Analyst",
                employeeNumber: "E-301");
            var active = Employee.Create(
                TenantId,
                "Casey",
                "Active",
                "casey.active@example.com",
                DateTime.UtcNow,
                jobTitle: "Manager",
                employeeNumber: "E-302");

            seedContext.Employees.AddRange(notInvited, pending, active);
            await seedContext.SaveChangesAsync();

            notInvitedId = notInvited.Id;
            pendingId = pending.Id;
            activeId = active.Id;
        }

        var statuses = new Dictionary<Guid, WorkforceAccountStatusDto>
        {
            [pendingId] = new(
                pendingId,
                "blair.pending@example.com",
                "Blair Pending",
                "Employee",
                [new WorkforceAccountAccessProfileDto(Guid.NewGuid(), "Employee", "SystemSeeded", true)],
                "InvitePending",
                null,
                false,
                null,
                Guid.NewGuid(),
                inviteCreatedAt,
                inviteCreatedAt.AddDays(7),
                "https://example.com/invite/blair",
                "Suppressed",
                null,
                inviteCreatedAt,
                null),
            [activeId] = new(
                activeId,
                "casey.active@example.com",
                "Casey Active",
                "Manager",
                [new WorkforceAccountAccessProfileDto(Guid.NewGuid(), "Manager", "SystemSeeded", true)],
                "Active",
                Guid.NewGuid(),
                true,
                lastLoginAt,
                null,
                null,
                null,
                null,
                null,
                null,
                lastLoginAt,
                null),
        };

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = CreateService(
            context,
            tenantContext,
            new StaticWorkforceAccountStatusReader(statuses));

        var result = await service.SearchAccessSubjectsAsync(
            search: null,
            access: null,
            profileId: null,
            employeeStatus: null,
            deliveryState: null,
            employeeKey: null,
            page: 1,
            pageSize: 20,
            cancellationToken: CancellationToken.None);

        Assert.Equal(3, result.TotalCount);

        var notInvited = Assert.Single(result.Items.Where(item => item.EmployeeId == notInvitedId));
        Assert.Equal("NotInvited", notInvited.AccessState);
        Assert.Equal("Not invited", notInvited.AccessStateLabel);
        Assert.Equal("Not sent", notInvited.InvitationLabel);
        Assert.Equal("No activity", notInvited.LastActivityLabel);

        var pending = Assert.Single(result.Items.Where(item => item.EmployeeId == pendingId));
        Assert.Equal("InvitePending", pending.AccessState);
        Assert.Equal("Invite pending", pending.AccessStateLabel);
        Assert.Equal("Link ready", pending.InvitationLabel);
        Assert.Equal("No activity", pending.LastActivityLabel);

        var active = Assert.Single(result.Items.Where(item => item.EmployeeId == activeId));
        Assert.Equal("ActiveAccount", active.AccessState);
        Assert.Equal("Active account", active.AccessStateLabel);
        Assert.Equal("Accepted", active.InvitationLabel);
        Assert.Equal("Last sign-in Jun 7", active.LastActivityLabel);
    }

    [Fact]
    public async Task SearchAccessSubjectsAsync_CollapsesInactiveAndConflictAccountsIntoNeedsReview()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid inactiveId;
        Guid conflictId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var inactive = Employee.Create(
                TenantId,
                "Iris",
                "Inactive",
                "iris.inactive@example.com",
                DateTime.UtcNow,
                jobTitle: "Analyst",
                employeeNumber: "E-303");
            var conflict = Employee.Create(
                TenantId,
                "Morgan",
                "Conflict",
                "morgan.conflict@example.com",
                DateTime.UtcNow,
                jobTitle: "Analyst",
                employeeNumber: "E-304");

            seedContext.Employees.AddRange(inactive, conflict);
            await seedContext.SaveChangesAsync();

            inactiveId = inactive.Id;
            conflictId = conflict.Id;
        }

        var statuses = new Dictionary<Guid, WorkforceAccountStatusDto>
        {
            [inactiveId] = new(
                inactiveId,
                "iris.inactive@example.com",
                "Iris Inactive",
                "Employee",
                [new WorkforceAccountAccessProfileDto(Guid.NewGuid(), "Employee", "SystemSeeded", true)],
                "Inactive",
                Guid.NewGuid(),
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null),
            [conflictId] = new(
                conflictId,
                "morgan.conflict@example.com",
                "Morgan Conflict",
                "Employee",
                [],
                "Conflict",
                null,
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new WorkforceAccountConflictDto(
                    "EmailAlreadyRegistered",
                    "This email is already linked to another account.",
                    true,
                    "Check the existing account before sending a new invitation."))
        };

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var service = CreateService(
            context,
            tenantContext,
            new StaticWorkforceAccountStatusReader(statuses));

        var result = await service.SearchAccessSubjectsAsync(
            search: null,
            access: null,
            profileId: null,
            employeeStatus: null,
            deliveryState: null,
            employeeKey: null,
            page: 1,
            pageSize: 20,
            cancellationToken: CancellationToken.None);

        var inactive = Assert.Single(result.Items.Where(item => item.EmployeeId == inactiveId));
        Assert.Equal("NeedsReview", inactive.AccessState);
        Assert.Equal("Needs review", inactive.AccessStateLabel);
        Assert.Equal("Account inactive", inactive.InvitationLabel);
        Assert.Equal("This account is inactive.", inactive.ReviewReason);

        var conflict = Assert.Single(result.Items.Where(item => item.EmployeeId == conflictId));
        Assert.Equal("NeedsReview", conflict.AccessState);
        Assert.Equal("Needs review", conflict.AccessStateLabel);
        Assert.Equal("This email is already linked to another account.", conflict.InvitationLabel);
        Assert.Equal("This email is already linked to another account.", conflict.AccessStateDetail);
        Assert.Equal("This email is already linked to another account.", conflict.ReviewReason);
    }

    private static WorkforceContractService CreateService(
        CoreHRDbContext context,
        TestTenantContext tenantContext,
        IWorkforceAccountStatusReader? workforceAccountStatusReader = null,
        IWorkforceBulkProvisioner? workforceBulkProvisioner = null)
        => new(
            context,
            tenantContext,
            new TenantSettingsReadService(context),
            new EmployeeReadModelPolicy(),
            workforceAccountStatusReader ?? new StaticWorkforceAccountStatusReader(new Dictionary<Guid, WorkforceAccountStatusDto>()),
            workforceBulkProvisioner ?? new StaticWorkforceBulkProvisioner());

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

    private sealed class StaticWorkforceAccountStatusReader(
        IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> statuses) : IWorkforceAccountStatusReader
    {
        public Task<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>> GetStatusesAsync(
            IReadOnlyCollection<WorkforceAccountSubjectDto> subjects,
            CancellationToken cancellationToken)
        {
            var result = statuses
                .Where(entry => subjects.Any(subject => subject.EmployeeId == entry.Key))
                .ToDictionary(entry => entry.Key, entry => entry.Value);

            return Task.FromResult<IReadOnlyDictionary<Guid, WorkforceAccountStatusDto>>(result);
        }
    }

    private sealed class StaticWorkforceBulkProvisioner : IWorkforceBulkProvisioner
    {
        private readonly WorkforceAccountStatusDto? _status;

        public StaticWorkforceBulkProvisioner(WorkforceAccountStatusDto? status = null)
        {
            _status = status;
        }

        public Task<WorkforceBulkProvisionResponse> BulkProvisionAsync(
            List<WorkforceBulkProvisionSubject> subjects,
            Guid accessProfileId,
            CancellationToken cancellationToken)
        {
            var provisionState = _status?.ProvisioningState ?? "Unprovisioned";
            var outcome = provisionState is "InvitePending" or "InviteExpired" or "InviteAccepted"
                ? "Created"
                : "Created";

            var items = subjects
                .Select(s => new WorkforceBulkProvisionResultItem(s.EmployeeId, outcome, "Invitation created."))
                .ToList();

            return Task.FromResult(new WorkforceBulkProvisionResponse(items));
        }
    }
}
