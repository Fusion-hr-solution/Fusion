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

    /// <summary>
    /// GAP WR-01: Locks the effective-date filter invariant.
    /// An expired reporting relationship (EffectiveTo &lt; at) and a future org membership
    /// (EffectiveFrom &gt; at) must both be excluded from GetAsync results.
    /// This test would fail if the date-filter WHERE clauses were removed.
    /// </summary>
    [Fact]
    public async Task GetAsync_ExcludesExpiredReportingRelationshipAndFutureOrgMembership()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);

        var manager = Employee.Create(tenantId, "Manager", "One", "manager.eff@example.com", at);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee.eff@example.com", at);
        var orgUnitId = Guid.NewGuid();
        var managerPosition = Position.Create(tenantId, "MGR-EFF-001", "Manager Position");
        var employeePosition = Position.Create(tenantId, "ENG-EFF-001", "Engineer Position");
        var managerAssignment = EmployeePositionAssignment.Create(tenantId, manager.Id, managerPosition.Id, true, at);
        var employeeAssignment = EmployeePositionAssignment.Create(tenantId, employee.Id, employeePosition.Id, true, at);

        // Expired relationship: EffectiveTo is before `at` — must be excluded
        var expiredRelationship = EmployeeReportingRelationship.Create(
            tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            effectiveFrom: at.AddDays(-10),
            effectiveTo: at.AddDays(-1));

        // Future org membership: EffectiveFrom is after `at` — must be excluded
        var futureMembership = EmployeeOrgMembership.Create(
            tenantId, employee.Id, orgUnitId,
            OrgMembershipType.Home, true,
            effectiveFrom: at.AddDays(1));

        db.AddRange(manager, employee, managerPosition, employeePosition,
            managerAssignment, employeeAssignment, expiredRelationship, futureMembership);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        // Expired relationship excluded: PrimaryManagerEmployeeId resolves to Guid.Empty (no entry in dictionary),
        // not to the manager's actual Id — if the filter were removed, it would be manager.Id.
        Assert.Equal(Guid.Empty, participant.PrimaryManagerEmployeeId);
        Assert.Empty(participant.PrimaryManagementChain);
        // Expired relationship excluded: no relationship candidates surfaced
        Assert.Empty(participant.RelationshipCandidates);
        // Future org membership excluded: no org unit membership
        Assert.Empty(participant.OrgUnitIds);
    }

    /// <summary>
    /// GAP IN-01: Locks the legacy-title suppression invariant.
    /// A CreateLegacy assignment (PositionId == null) must never count as a canonical
    /// position — the member must report MissingCanonicalPrimaryPosition and
    /// IsPacketAReady == false even when a legacy primary assignment exists.
    /// </summary>
    [Fact]
    public async Task GetAsync_LegacyTitleAssignment_DoesNotSatisfyCanonicalPositionRequirement()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);

        var employee = Employee.Create(tenantId, "Legacy", "Worker", "legacy.worker@example.com", at);

        // A legacy primary assignment: has IsPrimary=true but PositionId is null
        var legacyAssignment = EmployeePositionAssignment.CreateLegacy(
            tenantId, employee.Id,
            legacyPositionTitle: "Senior Analyst",
            isPrimary: true,
            effectiveFrom: at);

        db.AddRange(employee, legacyAssignment);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.True(participant.IsActive);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("MissingCanonicalPrimaryPosition", participant.RemediationCodes);
        // Legacy assignment must not be mistaken for a canonical position
        Assert.DoesNotContain("ConflictingPrimaryPositionAssignments", participant.RemediationCodes);
    }

    /// <summary>
    /// GAP IN-02a: Locks ConflictingPrimaryPositionAssignments.
    /// Two effective primary position assignments that each have a canonical PositionId
    /// must trigger the conflict remediation code and block Packet A readiness.
    /// </summary>
    [Fact]
    public async Task GetAsync_TwoCanonicalPrimaryPositionAssignments_ReportsConflict()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var orgUnitId = Guid.NewGuid();

        var employee = Employee.Create(tenantId, "Dual", "Assignment", "dual.assign@example.com", at);
        var positionA = Position.Create(tenantId, "POS-A-001", "Position A", orgUnitId);
        var positionB = Position.Create(tenantId, "POS-B-001", "Position B", orgUnitId);

        // Two overlapping primary assignments, both with canonical PositionIds
        var assignmentA = EmployeePositionAssignment.Create(tenantId, employee.Id, positionA.Id, isPrimary: true, at);
        var assignmentB = EmployeePositionAssignment.Create(tenantId, employee.Id, positionB.Id, isPrimary: true, at);

        db.AddRange(employee, positionA, positionB, assignmentA, assignmentB);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("ConflictingPrimaryPositionAssignments", participant.RemediationCodes);
    }

    /// <summary>
    /// GAP IN-02b: Locks PrimaryManagementCycle.
    /// A primary manager cycle (A's primary manager is B and B's primary manager is A)
    /// must trigger PrimaryManagementCycle and block Packet A readiness for both members.
    /// </summary>
    [Fact]
    public async Task GetAsync_PrimaryManagementCycleBetweenTwoEmployees_ReportsCycleForBoth()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);

        var employeeA = Employee.Create(tenantId, "Cycle", "Alpha", "cycle.alpha@example.com", at);
        var employeeB = Employee.Create(tenantId, "Cycle", "Beta", "cycle.beta@example.com", at);
        var positionA = Position.Create(tenantId, "CYC-A-001", "Cycle Position A");
        var positionB = Position.Create(tenantId, "CYC-B-001", "Cycle Position B");
        var assignmentA = EmployeePositionAssignment.Create(tenantId, employeeA.Id, positionA.Id, isPrimary: true, at);
        var assignmentB = EmployeePositionAssignment.Create(tenantId, employeeB.Id, positionB.Id, isPrimary: true, at);

        // A's primary manager is B, B's primary manager is A — mutual cycle
        var relAtoB = EmployeeReportingRelationship.Create(
            tenantId, employeeA.Id, employeeB.Id,
            assignmentA.Id, assignmentB.Id,
            ReportingRelationshipType.PrimaryManager, at);
        var relBtoA = EmployeeReportingRelationship.Create(
            tenantId, employeeB.Id, employeeA.Id,
            assignmentB.Id, assignmentA.Id,
            ReportingRelationshipType.PrimaryManager, at);

        db.AddRange(employeeA, employeeB, positionA, positionB, assignmentA, assignmentB, relAtoB, relBtoA);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employeeA.Id, employeeB.Id]);

        Assert.Equal(2, context.Members.Count);
        foreach (var member in context.Members)
        {
            Assert.False(member.IsPacketAReady);
            Assert.Contains("PrimaryManagementCycle", member.RemediationCodes);
        }
    }

    /// <summary>
    /// GAP IN-02c: Locks OrgUnitHierarchyCycle.
    /// When two org units reference each other as parents, any employee member of either
    /// unit must trigger OrgUnitHierarchyCycle and IsPacketAReady == false.
    /// The cycle is seeded via EF property API since OrgUnit.ParentId is private-set.
    /// </summary>
    [Fact]
    public async Task GetAsync_OrgUnitHierarchyCycle_ReportsCycleForMember()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);

        // Seed X with no parent, Y with X as parent (valid initial state)
        var orgUnitX = OrgUnit.Create(tenantId, "CYC-X", "Cycle Unit X", "Department", null);
        db.Add(orgUnitX);
        await db.SaveChangesAsync();

        var orgUnitY = OrgUnit.Create(tenantId, "CYC-Y", "Cycle Unit Y", "Department", orgUnitX.Id);
        db.Add(orgUnitY);
        await db.SaveChangesAsync();

        // Patch X.ParentId = Y.Id via EF property API to form the cycle (X ↔ Y)
        db.Entry(orgUnitX).Property("ParentId").CurrentValue = orgUnitY.Id;
        await db.SaveChangesAsync();

        var employee = Employee.Create(tenantId, "Cycle", "OrgMember", "cycle.orgmember@example.com", at);
        var position = Position.Create(tenantId, "CYC-ORG-001", "Cycle Org Position");
        var assignment = EmployeePositionAssignment.Create(tenantId, employee.Id, position.Id, isPrimary: true, at);
        var membership = EmployeeOrgMembership.Create(tenantId, employee.Id, orgUnitX.Id, OrgMembershipType.Home, true, at);

        db.AddRange(employee, position, assignment, membership);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("OrgUnitHierarchyCycle", participant.RemediationCodes);
    }
}
