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

    /// <summary>
    /// Locks the "no title inference" invariant: an active employee with NO
    /// EmployeePositionAssignment yields IsPacketAReady=false and
    /// RemediationCodes containing MissingCanonicalPrimaryPosition.
    /// Core does NOT fall back to any job-title string — absence of a canonical
    /// assignment blocks readiness entirely.
    /// </summary>
    [Fact]
    public async Task GetAsync_FlagsMissingCanonicalPositionInsteadOfInferringFromTitle()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var employee = Employee.Create(tenantId, "Alice", "Smith", "alice.smith@example.com", at);
        db.Add(employee);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.True(participant.IsActive);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("MissingCanonicalPrimaryPosition", participant.RemediationCodes);
        // Core does not infer a position from a job-title string: no canonical assignment
        // means no primary chain, proving readiness is blocked rather than falling back.
        Assert.Empty(participant.PrimaryManagementChain);
    }

    /// <summary>
    /// Locks the inactive-employee remediation invariant: a deactivated employee is
    /// flagged with InactiveEmployee and IsPacketAReady=false — inactive references
    /// are never silently emitted as usable workforce truth.
    /// </summary>
    [Fact]
    public async Task GetAsync_FlagsInactiveEmployeeAsRemediationAndNotPacketAReady()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var employee = Employee.Create(tenantId, "Bob", "Jones", "bob.jones@example.com", at);
        db.Add(employee);
        await db.SaveChangesAsync();

        // Deactivate the employee before querying
        employee.Deactivate();
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsActive);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("InactiveEmployee", participant.RemediationCodes);
    }

    /// <summary>
    /// Locks the relationship-candidate provenance invariant: a non-primary (MatrixManager)
    /// relationship candidate carries Source == "CoreReportingRelationship" and the typed
    /// ReportingRelationshipType so Performance can treat it as a candidate only, never
    /// silently elevating it to a primary-chain fact.
    /// </summary>
    [Fact]
    public async Task GetAsync_EmitsTypedRelationshipCandidatesWithCoreProvenance()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var manager = Employee.Create(tenantId, "Matrix", "Manager", "matrix.mgr@example.com", at);
        var employee = Employee.Create(tenantId, "Matrix", "Subject", "matrix.subject@example.com", at);
        var managerPosition = Position.Create(tenantId, "MXMGR-001", "Matrix Manager Position");
        var subjectPosition = Position.Create(tenantId, "MXSUB-001", "Subject Position");
        var managerAssignment = EmployeePositionAssignment.Create(tenantId, manager.Id, managerPosition.Id, true, at);
        var subjectAssignment = EmployeePositionAssignment.Create(tenantId, employee.Id, subjectPosition.Id, true, at);
        var matrixRelationship = EmployeeReportingRelationship.Create(
            tenantId, employee.Id, manager.Id,
            subjectAssignment.Id, managerAssignment.Id,
            ReportingRelationshipType.MatrixManager, at);

        db.AddRange(manager, employee, managerPosition, subjectPosition, managerAssignment, subjectAssignment, matrixRelationship);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        var candidate = Assert.Single(participant.RelationshipCandidates);
        Assert.Equal(ReportingRelationshipType.MatrixManager, candidate.Type);
        Assert.Equal(manager.Id, candidate.ManagerEmployeeId);
        Assert.Equal("CoreReportingRelationship", candidate.Source);
    }
}
