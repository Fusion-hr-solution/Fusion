using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public sealed class CampaignWorkforceContextServiceTests
{
    [Fact]
    public async Task GetDeltaAsync_ReportsOnlySelectedMembersWhoseWorkforceFactsChanged()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var manager = Employee.Create(tenantId, "Manager", "One", "manager@example.com", at);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        db.AddRange(manager, employee);
        await db.SaveChangesAsync();

        var service = new CampaignWorkforceContextService(db);
        var baseline = await service.GetAsync(at, [employee.Id], CancellationToken.None);

        employee.Deactivate();
        await db.SaveChangesAsync();

        var delta = await service.GetDeltaAsync(at.AddDays(1), baseline, CancellationToken.None);

        var changed = Assert.Single(delta.Changes);
        Assert.Equal(employee.Id, changed.EmployeeId);
        Assert.Contains("EmploymentStatusChanged", changed.ChangeCodes);
        Assert.Empty(delta.UnchangedEmployeeIds);
    }

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

    [Fact]
    public async Task GetAsync_ReportsCanonicalReadinessAndTypedRelationshipCandidatesWithAncestorScopes()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var parent = OrgUnit.Create(tenantId, "HQ", "Headquarters", "Division", null);
        db.Add(parent);
        await db.SaveChangesAsync();
        var team = OrgUnit.Create(tenantId, "TEAM", "Team", "Team", parent.Id);
        var manager = Employee.Create(tenantId, "Manager", "One", "manager@example.com", at);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        var managerPosition = Position.Create(tenantId, "MGR-002", "Manager", team.Id);
        var employeePosition = Position.Create(tenantId, "ENG-002", "Engineer", team.Id);
        var managerAssignment = EmployeePositionAssignment.Create(tenantId, manager.Id, managerPosition.Id, true, at);
        var employeeAssignment = EmployeePositionAssignment.Create(tenantId, employee.Id, employeePosition.Id, true, at);
        var primary = EmployeeReportingRelationship.Create(tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id, ReportingRelationshipType.PrimaryManager, at);
        var matrix = EmployeeReportingRelationship.Create(tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id, ReportingRelationshipType.MatrixManager, at);
        var membership = EmployeeOrgMembership.Create(tenantId, employee.Id, team.Id, OrgMembershipType.Home, true, at);

        db.AddRange(team, manager, employee, managerPosition, employeePosition,
            managerAssignment, employeeAssignment, primary, matrix, membership);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.True(participant.IsPacketAReady);
        Assert.Empty(participant.RemediationCodes);
        Assert.Contains(parent.Id, participant.AncestorOrgUnitIds);
        Assert.Contains(participant.RelationshipCandidates, relationship =>
            relationship.Type == ReportingRelationshipType.MatrixManager &&
            relationship.ManagerEmployeeId == manager.Id &&
            relationship.Source == "CoreReportingRelationship");
    }

    [Fact]
    public async Task GetAsync_BlocksEmployeeWithoutCanonicalPrimaryPosition()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        db.Add(employee);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("MissingCanonicalPrimaryPosition", participant.RemediationCodes);
        Assert.Contains("MissingPrimaryOrgMembership", participant.RemediationCodes);
    }
}
