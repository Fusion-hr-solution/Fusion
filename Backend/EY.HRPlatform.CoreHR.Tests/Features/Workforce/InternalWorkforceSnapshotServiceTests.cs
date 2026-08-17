using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public sealed class InternalWorkforceSnapshotServiceTests
{
    [Fact]
    public async Task ResolveEmployeesAsync_ResolvesJobOrgAndManagerFromCanonicalFactsAsOfDate()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var changeDate = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        var asOf = changeDate.AddDays(-1);

        var engineering = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var operations = OrgUnit.Create(tenantId, "OPS", "Operations", "Department", null);
        var managerA = Employee.Create(tenantId, "Maya", "Lead", "maya@example.com", start, employeeNumber: TestEmployeeNumbers.Next());
        var managerB = Employee.Create(tenantId, "Omar", "Director", "omar@example.com", start, employeeNumber: TestEmployeeNumbers.Next());
        var employee = Employee.Create(tenantId, "Alice", "Adams", "alice@example.com", start, employeeNumber: TestEmployeeNumbers.Next());
        db.AddRange(engineering, operations, managerA, managerB, employee);
        await db.SaveChangesAsync();

        var managerAEmployment = Employment.Start(tenantId, managerA.Id, start, null, WorkforceSourceType.Manual);
        var managerBEmployment = Employment.Start(tenantId, managerB.Id, start, null, WorkforceSourceType.Manual);
        var employeeEmployment = Employment.Start(tenantId, employee.Id, start, null, WorkforceSourceType.Manual);
        db.AddRange(managerAEmployment, managerBEmployment, employeeEmployment);
        await db.SaveChangesAsync();

        var managerAAssignment = WorkAssignment.Create(tenantId, managerAEmployment.Id, managerA.Id, engineering.Id, "Manager", null, true, start, null, WorkforceSourceType.Manual);
        var managerBAssignment = WorkAssignment.Create(tenantId, managerBEmployment.Id, managerB.Id, operations.Id, "Director", null, true, start, null, WorkforceSourceType.Manual);
        var employeeOriginalAssignment = WorkAssignment.Create(tenantId, employeeEmployment.Id, employee.Id, engineering.Id, "Engineer", null, true, start, changeDate, WorkforceSourceType.Manual);
        var employeeFutureAssignment = WorkAssignment.Create(tenantId, employeeEmployment.Id, employee.Id, operations.Id, "Senior Engineer", null, true, changeDate, null, WorkforceSourceType.Manual);
        db.AddRange(managerAAssignment, managerBAssignment, employeeOriginalAssignment, employeeFutureAssignment);
        await db.SaveChangesAsync();

        var originalManager = ManagerRelationship.Create(
            tenantId,
            employee.Id,
            managerA.Id,
            employeeOriginalAssignment.Id,
            managerAAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            start,
            WorkforceSourceType.Manual,
            effectiveTo: changeDate);
        var futureManager = ManagerRelationship.Create(
            tenantId,
            employee.Id,
            managerB.Id,
            employeeFutureAssignment.Id,
            managerBAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            changeDate,
            WorkforceSourceType.Manual);
        db.AddRange(originalManager, futureManager);
        await db.SaveChangesAsync();

        var snapshots = await new InternalWorkforceSnapshotService(db)
            .ResolveEmployeesAsync(asOf, [employee.Id], CancellationToken.None);

        var snapshot = Assert.Single(snapshots);
        Assert.True(snapshot.IsActive);
        Assert.Equal("Engineer", snapshot.JobTitle);
        Assert.Equal(engineering.Id, snapshot.OrgUnit!.OrgUnitId);
        Assert.Equal("Engineering", snapshot.OrgUnit.Name);
        Assert.Equal(managerA.Id, snapshot.Manager!.EmployeeId);
        Assert.Equal("Maya Lead", snapshot.Manager.DisplayName);
    }
}
