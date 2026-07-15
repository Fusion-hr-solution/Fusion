using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class EmployeeReportingRelationshipTests
{
    [Fact]
    public void Create_PrimaryManagerRelationship_IsEffectiveWithinItsDateRange()
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(6);
        var relationship = EmployeeReportingRelationship.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            ReportingRelationshipType.PrimaryManager, start, end);

        Assert.True(relationship.IsEffectiveOn(start.AddDays(1)));
        Assert.False(relationship.IsEffectiveOn(end));
    }

    [Fact]
    public void Create_RejectsSelfReporting()
    {
        var employeeId = Guid.NewGuid();

        var exception = Assert.Throws<ArgumentException>(() => EmployeeReportingRelationship.Create(
            Guid.NewGuid(), employeeId, employeeId, Guid.NewGuid(), Guid.NewGuid(),
            ReportingRelationshipType.PrimaryManager, DateTime.UtcNow));

        Assert.Equal("managerEmployeeId", exception.ParamName);
    }
}
