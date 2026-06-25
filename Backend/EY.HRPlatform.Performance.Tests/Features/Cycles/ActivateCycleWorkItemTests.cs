using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public sealed class ActivateCycleWorkItemTests
{
    [Fact]
    public async Task Handle_CreatesFrozenPlanningAndApprovalWorkItemsFromParticipantsAndResponsibilities()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10), now.AddDays(3));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
        db.CampaignAssignmentResponsibilities.Add(CampaignAssignmentResponsibility.Confirm(
            tenantId, cycle.Id, subjectId, managerId, "Manager", CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated, "PrimaryManager"));
        await db.SaveChangesAsync();

        var handler = new ActivateCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));

        var result = await handler.Handle(new ActivateCycleCommand(cycle.Id, cycle.Version), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, db.CampaignWorkItems.Count());
        Assert.Contains(db.CampaignWorkItems, item => item.Type == CampaignWorkItemType.ObjectivePlanning && item.AssigneeEmployeeId == subjectId);
        Assert.Contains(db.CampaignWorkItems, item => item.Type == CampaignWorkItemType.ObjectiveApproval && item.AssigneeEmployeeId == managerId);

        // CycleActivated notification sent to the responsibility assignee (managerId), not the subject
        Assert.Contains(db.PerformanceNotifications,
            n => n.Type == PerformanceNotificationType.CycleActivated
              && n.RecipientEmployeeId == managerId);
        Assert.DoesNotContain(db.PerformanceNotifications,
            n => n.Type == PerformanceNotificationType.CycleActivated
              && n.RecipientEmployeeId == subjectId);
    }
}
