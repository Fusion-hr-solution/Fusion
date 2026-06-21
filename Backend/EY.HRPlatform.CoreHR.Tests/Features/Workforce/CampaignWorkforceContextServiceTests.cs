using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public sealed class CampaignWorkforceContextServiceTests
{
    [Fact]
    public async Task GetAsync_ReturnsOnlyEffectivePrimaryRelationshipAndMembershipFacts()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var manager = Employee.Create(tenantId, "Manager", "One", "manager@example.com", at);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        var orgUnitId = Guid.NewGuid();
        var managerPosition = Position.Create(tenantId, "MGR-001", "Manager", orgUnitId);
        var employeePosition = Position.Create(tenantId, "ENG-001", "Engineer", orgUnitId);
        var managerAssignment = EmployeePositionAssignment.Create(tenantId, manager.Id, managerPosition.Id, true, at);
        var employeeAssignment = EmployeePositionAssignment.Create(tenantId, employee.Id, employeePosition.Id, true, at);
        var relationship = EmployeeReportingRelationship.Create(tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id, ReportingRelationshipType.PrimaryManager, at);
        var membership = EmployeeOrgMembership.Create(tenantId, employee.Id, orgUnitId, OrgMembershipType.Home, true, at);

        db.AddRange(manager, employee, managerPosition, employeePosition, managerAssignment, employeeAssignment, relationship, membership);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, CancellationToken.None);

        var participant = Assert.Single(context.Members.Where(member => member.EmployeeId == employee.Id));
        Assert.True(participant.IsActive);
        Assert.Equal(manager.Id, participant.PrimaryManagerEmployeeId);
        Assert.Contains(orgUnitId, participant.OrgUnitIds);
        Assert.False(string.IsNullOrWhiteSpace(context.SourceVersion));
    }
}
