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
}
