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
        var orgUnit = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        db.AddRange(orgUnit, employee);
        await db.SaveChangesAsync();

        var employment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        db.Add(employment);
        await db.SaveChangesAsync();

        var assignment = WorkAssignment.Create(tenantId, employment.Id, employee.Id, orgUnit.Id, "Engineer", null, true, at, null, WorkforceSourceType.Manual);
        db.Add(assignment);
        await db.SaveChangesAsync();

        var service = new CampaignWorkforceContextService(db);
        var baseline = await service.GetAsync(at, [employee.Id], CancellationToken.None);

        assignment.End(at.AddDays(1));
        employment.End(at.AddDays(1));
        await db.SaveChangesAsync();

        var delta = await service.GetDeltaAsync(at.AddDays(1), baseline, CancellationToken.None);

        var changed = Assert.Single(delta.Changes);
        Assert.Equal(employee.Id, changed.EmployeeId);
        Assert.Contains("EmploymentStatusChanged", changed.ChangeCodes);
        Assert.Empty(delta.UnchangedEmployeeIds);
    }

    [Fact]
    public async Task GetAsync_ReturnsOnlyEffectivePrimaryWorkAssignmentAndManagerRelationshipFacts()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var orgUnit = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var manager = Employee.Create(tenantId, "Manager", "One", "manager@example.com", at);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        db.AddRange(orgUnit, manager, employee);
        await db.SaveChangesAsync();

        var managerEmployment = Employment.Start(tenantId, manager.Id, at, null, WorkforceSourceType.Manual);
        var managerAssignment = WorkAssignment.Create(tenantId, managerEmployment.Id, manager.Id, orgUnit.Id, "Manager", null, true, at, null, WorkforceSourceType.Manual);
        var employeeEmployment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        var employeeAssignment = WorkAssignment.Create(tenantId, employeeEmployment.Id, employee.Id, orgUnit.Id, "Engineer", null, true, at, null, WorkforceSourceType.Manual);
        db.AddRange(managerEmployment, managerAssignment, employeeEmployment, employeeAssignment);
        await db.SaveChangesAsync();

        var relationship = ManagerRelationship.Create(tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id, ReportingRelationshipType.PrimaryManager, at, WorkforceSourceType.Manual);
        db.Add(relationship);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, CancellationToken.None);

        var participant = Assert.Single(context.Members.Where(member => member.EmployeeId == employee.Id));
        Assert.True(participant.IsActive);
        Assert.Equal(manager.Id, participant.PrimaryManagerEmployeeId);
        Assert.Contains(orgUnit.Id, participant.OrgUnitIds);
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
        db.AddRange(team, manager, employee);
        await db.SaveChangesAsync();

        var managerEmployment = Employment.Start(tenantId, manager.Id, at, null, WorkforceSourceType.Manual);
        var managerAssignment = WorkAssignment.Create(tenantId, managerEmployment.Id, manager.Id, team.Id, "Manager", null, true, at, null, WorkforceSourceType.Manual);
        var employeeEmployment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        var employeeAssignment = WorkAssignment.Create(tenantId, employeeEmployment.Id, employee.Id, team.Id, "Engineer", null, true, at, null, WorkforceSourceType.Manual);
        db.AddRange(managerEmployment, managerAssignment, employeeEmployment, employeeAssignment);
        await db.SaveChangesAsync();

        var primary = ManagerRelationship.Create(tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id, ReportingRelationshipType.PrimaryManager, at, WorkforceSourceType.Manual);
        var matrix = ManagerRelationship.Create(tenantId, employee.Id, manager.Id,
            employeeAssignment.Id, managerAssignment.Id, ReportingRelationshipType.MatrixManager, at, WorkforceSourceType.Manual);
        db.AddRange(primary, matrix);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.True(participant.IsPacketAReady);
        Assert.Empty(participant.RemediationCodes);
        Assert.Contains(parent.Id, participant.AncestorOrgUnitIds);
        Assert.Contains(participant.RelationshipCandidates, candidate =>
            candidate.Type == ReportingRelationshipType.MatrixManager &&
            candidate.ManagerEmployeeId == manager.Id &&
            candidate.Source == "CoreManagerRelationship");
    }

    [Fact]
    public async Task GetAsync_BlocksEmployeeWithoutPrimaryWorkAssignment()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee@example.com", at);
        db.Add(employee);
        await db.SaveChangesAsync();

        var employment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        db.Add(employment);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.True(participant.IsActive);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("MissingPrimaryWorkAssignment", participant.RemediationCodes);
        Assert.DoesNotContain("InactiveEmployee", participant.RemediationCodes);
    }

    /// <summary>
    /// Locks the "no inference" invariant: an active employee with no canonical primary
    /// WorkAssignment yields IsPacketAReady=false and MissingPrimaryWorkAssignment.
    /// Core does not fall back to any legacy field — absence of a canonical WorkAssignment
    /// blocks readiness entirely.
    /// </summary>
    [Fact]
    public async Task GetAsync_FlagsMissingWorkAssignmentInsteadOfInferringFromLegacyFields()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var employee = Employee.Create(tenantId, "Alice", "Smith", "alice.smith@example.com", at);
        db.Add(employee);
        await db.SaveChangesAsync();

        var employment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        db.Add(employment);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.True(participant.IsActive);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("MissingPrimaryWorkAssignment", participant.RemediationCodes);
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

        var employment = Employment.Start(tenantId, employee.Id, at.AddDays(-5), null, WorkforceSourceType.Manual);
        db.Add(employment);
        await db.SaveChangesAsync();

        employment.End(at.AddDays(-1));
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsActive);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("InactiveEmployee", participant.RemediationCodes);
    }

    /// <summary>
    /// Locks the relationship-candidate provenance invariant: a non-primary (MatrixManager)
    /// relationship candidate carries Source == "CoreManagerRelationship" and the typed
    /// ReportingRelationshipType so Performance can treat it as a candidate only, never
    /// silently elevating it to a primary-chain fact.
    /// </summary>
    [Fact]
    public async Task GetAsync_EmitsTypedRelationshipCandidatesWithCoreManagerProvenance()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var orgUnit = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var manager = Employee.Create(tenantId, "Matrix", "Manager", "matrix.mgr@example.com", at);
        var employee = Employee.Create(tenantId, "Matrix", "Subject", "matrix.subject@example.com", at);
        db.AddRange(orgUnit, manager, employee);
        await db.SaveChangesAsync();

        var managerEmployment = Employment.Start(tenantId, manager.Id, at, null, WorkforceSourceType.Manual);
        var managerAssignment = WorkAssignment.Create(tenantId, managerEmployment.Id, manager.Id, orgUnit.Id, "Manager", null, true, at, null, WorkforceSourceType.Manual);
        var subjectEmployment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        var subjectAssignment = WorkAssignment.Create(tenantId, subjectEmployment.Id, employee.Id, orgUnit.Id, "Engineer", null, true, at, null, WorkforceSourceType.Manual);
        db.AddRange(managerEmployment, managerAssignment, subjectEmployment, subjectAssignment);
        await db.SaveChangesAsync();

        var matrixRelationship = ManagerRelationship.Create(
            tenantId, employee.Id, manager.Id,
            subjectAssignment.Id, managerAssignment.Id,
            ReportingRelationshipType.MatrixManager, at, WorkforceSourceType.Manual);
        db.Add(matrixRelationship);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        var candidate = Assert.Single(participant.RelationshipCandidates);
        Assert.Equal(ReportingRelationshipType.MatrixManager, candidate.Type);
        Assert.Equal(manager.Id, candidate.ManagerEmployeeId);
        Assert.Equal("CoreManagerRelationship", candidate.Source);
    }

    /// <summary>
    /// GAP WR-01: Locks the effective-date filter invariant.
    /// An expired ManagerRelationship (EffectiveTo &lt; at) and a future primary WorkAssignment
    /// (EffectiveFrom &gt; at) must both be excluded from GetAsync results.
    /// </summary>
    [Fact]
    public async Task GetAsync_ExcludesExpiredManagerRelationshipAndFutureWorkAssignment()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var orgUnit = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var manager = Employee.Create(tenantId, "Manager", "One", "manager.eff@example.com", at);
        var employee = Employee.Create(tenantId, "Employee", "One", "employee.eff@example.com", at);
        db.AddRange(orgUnit, manager, employee);
        await db.SaveChangesAsync();

        var managerEmployment = Employment.Start(tenantId, manager.Id, at, null, WorkforceSourceType.Manual);
        var managerAssignment = WorkAssignment.Create(tenantId, managerEmployment.Id, manager.Id, orgUnit.Id, "Manager", null, true, at, null, WorkforceSourceType.Manual);
        var employeeEmployment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        db.AddRange(managerEmployment, managerAssignment, employeeEmployment);
        await db.SaveChangesAsync();

        // Expired ManagerRelationship: EffectiveTo is before `at` — must be excluded.
        var employeeAssignmentForRelationship = WorkAssignment.Create(tenantId, employeeEmployment.Id, employee.Id, orgUnit.Id, "Engineer", null, true, at.AddDays(-10), at.AddDays(-1), WorkforceSourceType.Manual);
        db.Add(employeeAssignmentForRelationship);
        await db.SaveChangesAsync();

        var expiredRelationship = ManagerRelationship.Create(
            tenantId, employee.Id, manager.Id,
            employeeAssignmentForRelationship.Id, managerAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            at.AddDays(-10), WorkforceSourceType.Manual,
            effectiveTo: at.AddDays(-1));
        db.Add(expiredRelationship);

        // Future primary WorkAssignment: EffectiveFrom is after `at` — must be excluded.
        var futureAssignment = WorkAssignment.Create(tenantId, employeeEmployment.Id, employee.Id, orgUnit.Id, "Senior Engineer", null, true, at.AddDays(1), null, WorkforceSourceType.Manual);
        db.Add(futureAssignment);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        // Expired relationship excluded: no active primary manager remains.
        Assert.Null(participant.PrimaryManagerEmployeeId);
        Assert.Empty(participant.PrimaryManagementChain);
        // Expired relationship excluded: no relationship candidates surfaced.
        Assert.Empty(participant.RelationshipCandidates);
        // Future work assignment excluded: no org unit assignment.
        Assert.Empty(participant.OrgUnitIds);
    }

    /// <summary>
    /// GAP IN-02a: Locks ConflictingPrimaryWorkAssignments.
    /// Two effective primary WorkAssignments at the same time must trigger the conflict
    /// remediation code and block Packet A readiness.
    /// </summary>
    [Fact]
    public async Task GetAsync_TwoPrimaryWorkAssignments_ReportsConflict()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var at = new DateTime(2026, 6, 21, 0, 0, 0, DateTimeKind.Utc);
        var orgUnit = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var employee = Employee.Create(tenantId, "Dual", "Assignment", "dual.assign@example.com", at);
        db.AddRange(orgUnit, employee);
        await db.SaveChangesAsync();

        var employment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        db.Add(employment);
        await db.SaveChangesAsync();

        // Two overlapping primary assignments.
        var assignmentA = WorkAssignment.Create(tenantId, employment.Id, employee.Id, orgUnit.Id, "Engineer A", null, true, at, null, WorkforceSourceType.Manual);
        var assignmentB = WorkAssignment.Create(tenantId, employment.Id, employee.Id, orgUnit.Id, "Engineer B", null, true, at, null, WorkforceSourceType.Manual);
        db.AddRange(assignmentA, assignmentB);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("ConflictingPrimaryWorkAssignments", participant.RemediationCodes);
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
        var orgUnit = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var employeeA = Employee.Create(tenantId, "Cycle", "Alpha", "cycle.alpha@example.com", at);
        var employeeB = Employee.Create(tenantId, "Cycle", "Beta", "cycle.beta@example.com", at);
        db.AddRange(orgUnit, employeeA, employeeB);
        await db.SaveChangesAsync();

        var employmentA = Employment.Start(tenantId, employeeA.Id, at, null, WorkforceSourceType.Manual);
        var employmentB = Employment.Start(tenantId, employeeB.Id, at, null, WorkforceSourceType.Manual);
        db.AddRange(employmentA, employmentB);
        await db.SaveChangesAsync();

        var assignmentA = WorkAssignment.Create(tenantId, employmentA.Id, employeeA.Id, orgUnit.Id, "Engineer A", null, true, at, null, WorkforceSourceType.Manual);
        var assignmentB = WorkAssignment.Create(tenantId, employmentB.Id, employeeB.Id, orgUnit.Id, "Engineer B", null, true, at, null, WorkforceSourceType.Manual);
        db.AddRange(assignmentA, assignmentB);
        await db.SaveChangesAsync();

        // A's primary manager is B, B's primary manager is A — mutual cycle.
        var relAtoB = ManagerRelationship.Create(
            tenantId, employeeA.Id, employeeB.Id,
            assignmentA.Id, assignmentB.Id,
            ReportingRelationshipType.PrimaryManager, at, WorkforceSourceType.Manual);
        var relBtoA = ManagerRelationship.Create(
            tenantId, employeeB.Id, employeeA.Id,
            assignmentB.Id, assignmentA.Id,
            ReportingRelationshipType.PrimaryManager, at, WorkforceSourceType.Manual);
        db.AddRange(relAtoB, relBtoA);
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

        // Seed X with no parent, Y with X as parent (valid initial state).
        var orgUnitX = OrgUnit.Create(tenantId, "CYC-X", "Cycle Unit X", "Department", null);
        db.Add(orgUnitX);
        await db.SaveChangesAsync();

        var orgUnitY = OrgUnit.Create(tenantId, "CYC-Y", "Cycle Unit Y", "Department", orgUnitX.Id);
        db.Add(orgUnitY);
        await db.SaveChangesAsync();

        // Patch X.ParentId = Y.Id via EF property API to form the cycle (X ↔ Y).
        db.Entry(orgUnitX).Property("ParentId").CurrentValue = orgUnitY.Id;
        await db.SaveChangesAsync();

        var employee = Employee.Create(tenantId, "Cycle", "OrgMember", "cycle.orgmember@example.com", at);
        db.Add(employee);
        await db.SaveChangesAsync();

        var employment = Employment.Start(tenantId, employee.Id, at, null, WorkforceSourceType.Manual);
        db.Add(employment);
        await db.SaveChangesAsync();

        var assignment = WorkAssignment.Create(tenantId, employment.Id, employee.Id, orgUnitX.Id, "Analyst", null, true, at, null, WorkforceSourceType.Manual);
        db.Add(assignment);
        await db.SaveChangesAsync();

        var context = await new CampaignWorkforceContextService(db).GetAsync(at, [employee.Id]);

        var participant = Assert.Single(context.Members);
        Assert.False(participant.IsPacketAReady);
        Assert.Contains("OrgUnitHierarchyCycle", participant.RemediationCodes);
    }
}
