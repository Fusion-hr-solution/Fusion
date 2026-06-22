using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class GetCampaignResponsibilitiesQueryTests
{
    [Fact]
    public async Task Handle_ReturnsConfirmedAndMissingParticipantsFromResponsibilityRevisions()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(2, now);
        var confirmedSubjectId = Guid.NewGuid();
        var missingSubjectId = Guid.NewGuid();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.AddRange(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, confirmedSubjectId, "Confirmed Person"),
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, missingSubjectId, "Missing Person"));
        db.CampaignAssignmentResponsibilities.Add(CampaignAssignmentResponsibility.Confirm(
            tenantId, cycle.Id, confirmedSubjectId, Guid.NewGuid(), "Manager", CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated, "PrimaryManager"));
        await db.SaveChangesAsync();

        var handler = new GetCampaignResponsibilitiesQueryHandler(db);
        var result = await handler.Handle(new GetCampaignResponsibilitiesQuery(cycle.Id, "all"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.ParticipantCount);
        Assert.Equal(1, result.Value.ConfirmedObjectiveResponsibilityCount);
        Assert.Equal(1, result.Value.MissingObjectiveResponsibilityCount);
        Assert.Contains(result.Value.Items, item => item.SubjectEmployeeId == confirmedSubjectId && item.CurrentResponsibility is not null);
        Assert.Contains(result.Value.Items, item => item.SubjectEmployeeId == missingSubjectId && item.CurrentResponsibility is null);
    }
}
