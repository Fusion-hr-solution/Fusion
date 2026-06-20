using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class CampaignAssignmentResponsibilityTests
{
    [Fact]
    public void Confirmed_FinalResponsibility_PreservesExplicitOverrideReason()
    {
        var responsibility = CampaignAssignmentResponsibility.Confirm(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated,
            "PrimaryManager", "Manager is on approved leave.");

        Assert.True(responsibility.IsFinal);
        Assert.Equal("Manager is on approved leave.", responsibility.OverrideReason);
        Assert.Equal(CampaignAssignmentSource.Curated, responsibility.Source);
    }

    [Fact]
    public void Confirmed_FinalResponsibility_RejectsSelfAssignment()
    {
        var employeeId = Guid.NewGuid();

        Assert.Throws<DomainRuleViolationException>(() => CampaignAssignmentResponsibility.Confirm(
            Guid.NewGuid(), Guid.NewGuid(), employeeId, employeeId,
            CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated,
            "PrimaryManager", "Not allowed"));
    }
}
