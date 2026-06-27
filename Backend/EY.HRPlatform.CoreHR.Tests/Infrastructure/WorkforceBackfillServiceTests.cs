using System.Reflection;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Backfill;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Infrastructure;

public class WorkforceBackfillServiceTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly DateTime Hire = new(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

    private static CoreHRDbContext NewContext(out string dbName)
    {
        dbName = Guid.NewGuid().ToString();
        return TestDbContextFactory.CreateWithoutTenant(dbName);
    }

    private static OrgUnit SeedOrgUnit(string code = "ENG")
        => OrgUnit.Create(Tenant, code, $"{code} Unit", "Department", parentId: null);

    private static Employee SeedEmployee(string first, Guid? orgUnitId = null, Guid? managerId = null)
    {
        var employee = Employee.Create(Tenant, first, "Doe", $"{first}@ey-hr.com", Hire, jobTitle: "Engineer");
        if (orgUnitId is { } o)
            employee.AssignOrgUnit(o);
        if (managerId is { } m)
            employee.AssignManager(m);
        return employee;
    }

    private static void SetPrivate<T>(object entity, string property, T value)
        => typeof(Employee).GetProperty(property, BindingFlags.Public | BindingFlags.Instance)!
            .SetValue(entity, value);

    private static async Task<List<WorkforceBackfillDiagnostic>> CaptureDiagnosticsAsync(CoreHRDbContext context)
    {
        var ex = await Assert.ThrowsAsync<WorkforceBackfillException>(
            () => new WorkforceBackfillService(context).BackfillTenantAsync(Tenant, CancellationToken.None));
        return ex.Diagnostics.ToList();
    }

    [Fact]
    public async Task Backfill_CreatesCanonicalChain_ForManagerAndReport()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var manager = SeedEmployee("Manager", org.Id);
        var report = SeedEmployee("Report", org.Id, manager.Id);
        context.AddRange(org, manager, report);
        await context.SaveChangesAsync();

        var result = await new WorkforceBackfillService(context).BackfillTenantAsync(Tenant, CancellationToken.None);

        Assert.Equal(2, result.EmploymentsCreated);
        Assert.Equal(2, result.WorkAssignmentsCreated);
        Assert.Equal(1, result.ManagerRelationshipsCreated);
        Assert.Equal(0, result.EmployeesWithoutOrgContext);

        var employments = await context.Employments.IgnoreQueryFilters().ToListAsync();
        Assert.All(employments, e => Assert.Equal(WorkforceSourceType.Migration, e.Source));
        Assert.All(employments, e => Assert.Equal(EmploymentStatus.Active, e.Status));
        Assert.All(employments, e => Assert.Null(e.EffectiveTo));

        var relationship = await context.ManagerRelationships.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(report.Id, relationship.SubjectEmployeeId);
        Assert.Equal(manager.Id, relationship.ManagerEmployeeId);
        Assert.Equal(ReportingRelationshipType.PrimaryManager, relationship.Type);
    }

    [Fact]
    public async Task Backfill_IsIdempotent_SkipsAlreadyBackfilledEmployees()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var employee = SeedEmployee("Solo", org.Id);
        context.AddRange(org, employee);
        await context.SaveChangesAsync();

        await new WorkforceBackfillService(context).BackfillTenantAsync(Tenant, CancellationToken.None);
        var second = await new WorkforceBackfillService(context).BackfillTenantAsync(Tenant, CancellationToken.None);

        Assert.Equal(0, second.EmploymentsCreated);
        Assert.Equal(1, await context.Employments.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Backfill_EndsEmployment_ForInactiveEmployeeUsingUpdatedAt()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var employee = SeedEmployee("Gone", org.Id);
        employee.Deactivate(); // sets UpdatedAt to now (> hire date)
        context.AddRange(org, employee);
        await context.SaveChangesAsync();

        await new WorkforceBackfillService(context).BackfillTenantAsync(Tenant, CancellationToken.None);

        var employment = await context.Employments.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(EmploymentStatus.Ended, employment.Status);
        Assert.NotNull(employment.EffectiveTo);
    }

    [Fact]
    public async Task Backfill_NoOrgContext_LeavesReadinessGap_NotError()
    {
        await using var context = NewContext(out _);
        var employee = SeedEmployee("Orphan"); // no org unit, no membership
        context.Add(employee);
        await context.SaveChangesAsync();

        var result = await new WorkforceBackfillService(context).BackfillTenantAsync(Tenant, CancellationToken.None);

        Assert.Equal(1, result.EmploymentsCreated);
        Assert.Equal(0, result.WorkAssignmentsCreated);
        Assert.Equal(1, result.EmployeesWithoutOrgContext);
    }

    [Fact]
    public async Task Backfill_ConflictingOrgSources_FailsFast()
    {
        await using var context = NewContext(out _);
        var legacyOrg = SeedOrgUnit("LEGACY");
        var membershipOrg = SeedOrgUnit("MEMBER");
        var employee = SeedEmployee("Split", legacyOrg.Id);
        var membership = EmployeeOrgMembership.Create(Tenant, employee.Id, membershipOrg.Id, OrgMembershipType.Home, isPrimary: true, Hire);
        context.AddRange(legacyOrg, membershipOrg, employee, membership);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.ConflictingOrgSources);
        Assert.Empty(await context.Employments.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task Backfill_MultipleActivePrimaryMemberships_FailsFast()
    {
        await using var context = NewContext(out _);
        var orgA = SeedOrgUnit("A");
        var orgB = SeedOrgUnit("B");
        var employee = SeedEmployee("Matrixed");
        var m1 = EmployeeOrgMembership.Create(Tenant, employee.Id, orgA.Id, OrgMembershipType.Home, isPrimary: true, Hire);
        var m2 = EmployeeOrgMembership.Create(Tenant, employee.Id, orgB.Id, OrgMembershipType.Home, isPrimary: true, Hire);
        context.AddRange(orgA, orgB, employee, m1, m2);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.MultipleActivePrimaryMemberships);
    }

    [Fact]
    public async Task Backfill_ManagerCycle_FailsFast()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var a = SeedEmployee("Ay", org.Id);
        var b = SeedEmployee("Bee", org.Id);
        a.AssignManager(b.Id);
        b.AssignManager(a.Id);
        context.AddRange(org, a, b);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.ManagerCycle);
    }

    [Fact]
    public async Task Backfill_ManagerNotFound_FailsFast()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var employee = SeedEmployee("Lost", org.Id, managerId: Guid.NewGuid());
        context.AddRange(org, employee);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.ManagerNotFound);
    }

    [Fact]
    public async Task Backfill_OrgUnitNotFound_FailsFast()
    {
        await using var context = NewContext(out _);
        var employee = SeedEmployee("Dangling", orgUnitId: Guid.NewGuid());
        context.Add(employee);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.OrgUnitNotFound);
    }

    [Fact]
    public async Task Backfill_ManagerWithoutOrgContext_FailsFast()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var manager = SeedEmployee("NoOrgMgr"); // manager lacks org context => no assignment
        var report = SeedEmployee("Reportee", org.Id, manager.Id);
        context.AddRange(org, manager, report);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.ManagerAssignmentMissing);
    }

    [Fact]
    public async Task Backfill_SelfManagement_FailsFast()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var employee = SeedEmployee("Solo", org.Id);
        SetPrivate(employee, nameof(Employee.ManagerId), (Guid?)employee.Id); // bypass domain guard
        context.AddRange(org, employee);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.SelfManagement);
    }

    [Fact]
    public async Task Backfill_InactiveWithoutEndDate_FailsFast()
    {
        await using var context = NewContext(out _);
        var org = SeedOrgUnit();
        var employee = SeedEmployee("Ghost", org.Id);
        SetPrivate(employee, nameof(Employee.Status), EmployeeStatus.Inactive);
        SetPrivate(employee, nameof(Employee.UpdatedAt), (DateTime?)null); // no deactivation timestamp
        context.AddRange(org, employee);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.MissingEndDateForInactive);
    }

    [Fact]
    public async Task Backfill_InvalidResponsibleManager_FailsFast()
    {
        await using var context = NewContext(out _);
        var org = OrgUnit.Create(Tenant, "OPS", "Ops", "Department", parentId: null, responsibleManagerEmployeeId: Guid.NewGuid());
        var employee = SeedEmployee("Worker", org.Id);
        context.AddRange(org, employee);
        await context.SaveChangesAsync();

        var diagnostics = await CaptureDiagnosticsAsync(context);

        Assert.Contains(diagnostics, d => d.Code == WorkforceBackfillDiagnosticCodes.ResponsibleManagerInvalid);
    }
}
