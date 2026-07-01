using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceCycleParticipantTests
{
    [Fact]
    public void Snapshot_DoesNotExposeRetiredPlanningApproverProjection()
    {
        var propertyNames = typeof(PerformanceCycleParticipant)
            .GetProperties()
            .Select(property => property.Name);

        Assert.DoesNotContain("PlanningApproverEmployeeId", propertyNames);
        Assert.DoesNotContain("PlanningApproverName", propertyNames);
        Assert.DoesNotContain("PlanningApproverSource", propertyNames);
    }

    [Fact]
    public void Create_PreservesCoreManagerContextWithoutGrantingWorkflowAuthority()
    {
        var participant = PerformanceCycleParticipant.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Employee One",
            managerId: Guid.NewGuid(),
            managerName: "Manager One");

        Assert.NotNull(participant.ManagerId);
        Assert.Equal("Manager One", participant.ManagerName);
    }
}
