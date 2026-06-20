using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceCycleParticipantTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid CycleId = Guid.NewGuid();

    [Fact]
    public void Create_WithDirectManager_KeepsManagerAsContextOnly()
    {
        var employeeId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        var participant = PerformanceCycleParticipant.Create(
            TenantId,
            CycleId,
            employeeId,
            "Employee One",
            managerId: managerId,
            managerName: "Manager One");

        Assert.Equal(managerId, participant.ManagerId);
        Assert.False(participant.HasResolvedPlanningApprover);
        Assert.Equal(PlanningApproverSource.Unresolved, participant.PlanningApproverSource);
    }

    [Fact]
    public void Create_WithoutManager_RequiresManualApproverAssignment()
    {
        var participant = PerformanceCycleParticipant.Create(
            TenantId,
            CycleId,
            Guid.NewGuid(),
            "Employee One");

        Assert.False(participant.HasResolvedPlanningApprover);
        Assert.Equal(PlanningApproverSource.Unresolved, participant.PlanningApproverSource);
    }

    [Fact]
    public void AssignPlanningApprover_RejectsSelfApproval()
    {
        var employeeId = Guid.NewGuid();
        var participant = PerformanceCycleParticipant.Create(TenantId, CycleId, employeeId, "Employee One");

        Assert.Throws<DomainRuleViolationException>(() =>
            participant.AssignPlanningApprover(employeeId, "Employee One", "Missing manager"));
    }

    [Fact]
    public void AssignPlanningApprover_RecordsManualAssignmentAndReason()
    {
        var participant = PerformanceCycleParticipant.Create(TenantId, CycleId, Guid.NewGuid(), "Employee One");
        var approverId = Guid.NewGuid();

        participant.AssignPlanningApprover(approverId, "HR Approver", "Manager role is vacant");

        Assert.True(participant.HasResolvedPlanningApprover);
        Assert.Equal(approverId, participant.PlanningApproverEmployeeId);
        Assert.Equal(PlanningApproverSource.ManualAssignment, participant.PlanningApproverSource);
        Assert.Equal("Manager role is vacant", participant.PlanningApproverOverrideReason);
    }

    [Fact]
    public void AssignEscalatedPlanningApprover_RecordsEscalationWithoutManualReason()
    {
        var participant = PerformanceCycleParticipant.Create(TenantId, CycleId, Guid.NewGuid(), "Employee One");
        var approverId = Guid.NewGuid();

        participant.AssignEscalatedPlanningApprover(approverId, "Senior Manager");

        Assert.True(participant.HasResolvedPlanningApprover);
        Assert.Equal(PlanningApproverSource.EscalatedManager, participant.PlanningApproverSource);
        Assert.Null(participant.PlanningApproverOverrideReason);
    }
}
