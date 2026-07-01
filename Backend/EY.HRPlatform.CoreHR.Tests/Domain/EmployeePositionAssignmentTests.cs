using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class EmployeePositionAssignmentTests
{
    [Fact]
    public void Create_ReferencesCanonicalPosition()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var positionId = Guid.NewGuid();
        var effectiveFrom = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var assignment = EmployeePositionAssignment.Create(
            tenantId, employeeId, positionId, isPrimary: true, effectiveFrom);

        Assert.Equal(positionId, assignment.PositionId);
        Assert.True(assignment.IsPrimary);
        Assert.True(assignment.IsEffectiveOn(effectiveFrom));
    }
}
