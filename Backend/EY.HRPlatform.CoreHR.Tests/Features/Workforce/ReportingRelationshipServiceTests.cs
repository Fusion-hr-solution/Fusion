using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public class ReportingRelationshipServiceTests
{
    [Fact]
    public async Task AddAsync_RejectsOverlappingPrimaryManagerRelationshipsForTheSameAssignment()
    {
        var tenantId = Guid.NewGuid();
        var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var subject = Employee.Create(tenantId, "Subject", "Employee", "subject@example.com", DateTime.UtcNow);
        var firstManager = Employee.Create(tenantId, "First", "Manager", "first.manager@example.com", DateTime.UtcNow);
        var secondManager = Employee.Create(tenantId, "Second", "Manager", "second.manager@example.com", DateTime.UtcNow);
        context.Employees.AddRange(subject, firstManager, secondManager);
        await context.SaveChangesAsync();

        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var subjectPosition = Position.Create(tenantId, "ENG-001", "Engineer");
        var firstManagerPosition = Position.Create(tenantId, "MGR-001", "Manager");
        var secondManagerPosition = Position.Create(tenantId, "MGR-002", "Manager");
        var subjectAssignment = EmployeePositionAssignment.Create(tenantId, subject.Id, subjectPosition.Id, true, start);
        var firstManagerAssignment = EmployeePositionAssignment.Create(tenantId, firstManager.Id, firstManagerPosition.Id, true, start);
        var secondManagerAssignment = EmployeePositionAssignment.Create(tenantId, secondManager.Id, secondManagerPosition.Id, true, start);
        context.Positions.AddRange(subjectPosition, firstManagerPosition, secondManagerPosition);
        context.EmployeePositionAssignments.AddRange(subjectAssignment, firstManagerAssignment, secondManagerAssignment);
        await context.SaveChangesAsync();
        var service = new ReportingRelationshipService(context);

        await service.AddAsync(subject.Id, firstManager.Id, subjectAssignment.Id, firstManagerAssignment.Id,
            ReportingRelationshipType.PrimaryManager, start, null, CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AddAsync(
            subject.Id, secondManager.Id, subjectAssignment.Id, secondManagerAssignment.Id,
            ReportingRelationshipType.PrimaryManager, start.AddDays(1), null, CancellationToken.None));
    }

    /// <summary>
    /// Locks the cycle invariant: if A already reports to B as PrimaryManager,
    /// adding B→A as PrimaryManager must be rejected (cycle detection).
    /// </summary>
    [Fact]
    public async Task AddAsync_RejectsPrimaryManagementCycle()
    {
        var tenantId = Guid.NewGuid();
        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var employeeA = Employee.Create(tenantId, "Alice", "Smith", "alice@example.com", start);
        var employeeB = Employee.Create(tenantId, "Bob", "Jones", "bob@example.com", start);
        context.Employees.AddRange(employeeA, employeeB);
        await context.SaveChangesAsync();

        var positionA = Position.Create(tenantId, "ENG-A", "Engineer A");
        var positionB = Position.Create(tenantId, "MGR-B", "Manager B");
        var assignmentA = EmployeePositionAssignment.Create(tenantId, employeeA.Id, positionA.Id, true, start);
        var assignmentB = EmployeePositionAssignment.Create(tenantId, employeeB.Id, positionB.Id, true, start);
        context.Positions.AddRange(positionA, positionB);
        context.EmployeePositionAssignments.AddRange(assignmentA, assignmentB);
        await context.SaveChangesAsync();

        var service = new ReportingRelationshipService(context);

        // Establish A→B (A reports to B as PrimaryManager)
        await service.AddAsync(
            employeeA.Id, employeeB.Id,
            assignmentA.Id, assignmentB.Id,
            ReportingRelationshipType.PrimaryManager,
            start, null, CancellationToken.None);

        // Attempt B→A — should be rejected (creates A→B→A cycle)
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AddAsync(
            employeeB.Id, employeeA.Id,
            assignmentB.Id, assignmentA.Id,
            ReportingRelationshipType.PrimaryManager,
            start, null, CancellationToken.None));
    }

    /// <summary>
    /// Locks the canonical-assignment invariant: a PrimaryManager edge requires the
    /// subject's position assignment to have IsPrimary = true.
    /// </summary>
    [Fact]
    public async Task AddAsync_RejectsPrimaryManagerEdgeOnNonPrimaryAssignment()
    {
        var tenantId = Guid.NewGuid();
        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var subject = Employee.Create(tenantId, "Subject", "Employee", "subject2@example.com", start);
        var manager = Employee.Create(tenantId, "Mgr", "Person", "mgr2@example.com", start);
        context.Employees.AddRange(subject, manager);
        await context.SaveChangesAsync();

        var subjectPosition = Position.Create(tenantId, "ENG-002", "Engineer");
        var managerPosition = Position.Create(tenantId, "MGR-003", "Manager");
        // IsPrimary = false for the subject assignment
        var nonPrimaryAssignment = EmployeePositionAssignment.Create(tenantId, subject.Id, subjectPosition.Id, false, start);
        var managerAssignment = EmployeePositionAssignment.Create(tenantId, manager.Id, managerPosition.Id, true, start);
        context.Positions.AddRange(subjectPosition, managerPosition);
        context.EmployeePositionAssignments.AddRange(nonPrimaryAssignment, managerAssignment);
        await context.SaveChangesAsync();

        var service = new ReportingRelationshipService(context);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AddAsync(
            subject.Id, manager.Id,
            nonPrimaryAssignment.Id, managerAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            start, null, CancellationToken.None));
    }

    /// <summary>
    /// Locks the "per-context not permanent" invariant: a second PrimaryManager edge for
    /// the same subject assignment is accepted when date ranges are strictly disjoint,
    /// and both rows are persisted.
    /// </summary>
    [Fact]
    public async Task AddAsync_AllowsSuccessivePrimaryManagerWhenDateRangesDoNotOverlap()
    {
        var tenantId = Guid.NewGuid();
        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var subject = Employee.Create(tenantId, "Subject", "Worker", "subject3@example.com", start);
        var firstManager = Employee.Create(tenantId, "First", "Mgr", "first2@example.com", start);
        var secondManager = Employee.Create(tenantId, "Second", "Mgr", "second2@example.com", start);
        context.Employees.AddRange(subject, firstManager, secondManager);
        await context.SaveChangesAsync();

        var subjectPosition = Position.Create(tenantId, "ENG-003", "Engineer");
        var firstMgrPosition = Position.Create(tenantId, "MGR-004", "Manager");
        var secondMgrPosition = Position.Create(tenantId, "MGR-005", "Manager");
        var subjectAssignment = EmployeePositionAssignment.Create(tenantId, subject.Id, subjectPosition.Id, true, start);
        var firstMgrAssignment = EmployeePositionAssignment.Create(tenantId, firstManager.Id, firstMgrPosition.Id, true, start);
        var secondMgrAssignment = EmployeePositionAssignment.Create(tenantId, secondManager.Id, secondMgrPosition.Id, true, start);
        context.Positions.AddRange(subjectPosition, firstMgrPosition, secondMgrPosition);
        context.EmployeePositionAssignments.AddRange(subjectAssignment, firstMgrAssignment, secondMgrAssignment);
        await context.SaveChangesAsync();

        var service = new ReportingRelationshipService(context);
        var midpoint = start.AddMonths(6);

        // First edge: start → midpoint (closed)
        await service.AddAsync(
            subject.Id, firstManager.Id,
            subjectAssignment.Id, firstMgrAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            start, midpoint, CancellationToken.None);

        // Second edge: midpoint → open (strictly after first edge ends)
        await service.AddAsync(
            subject.Id, secondManager.Id,
            subjectAssignment.Id, secondMgrAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            midpoint, null, CancellationToken.None);

        // Both rows should be persisted for this subject assignment
        var persistedCount = context.EmployeeReportingRelationships
            .Count(r => r.SubjectPositionAssignmentId == subjectAssignment.Id
                        && r.Type == ReportingRelationshipType.PrimaryManager);
        Assert.Equal(2, persistedCount);
    }
}
