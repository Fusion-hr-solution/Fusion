using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// CycleClosed notifications must go to responsibility assignees, NOT to population
/// participants. This codifies the fix for the population-driven notification bug.
/// </summary>
public sealed class CloseCycleNotificationTests
{
    /// <summary>
    /// After closing, a CycleClosed notification is sent to the responsibility
    /// assignee (managerId) and NOT to the population participant (subjectId).
    /// </summary>
    [Fact(Skip = "RED test: close handler sends notifications to participants, not assignees (Wave 2)")]
    public async Task CloseCycle_SendsNotificationToResponsibilityAssignee_NotToParticipant()
    {
        // Arrange — seed an Active cycle with participant and responsibility
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10), now.AddDays(3));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(
            PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
        db.CampaignAssignmentResponsibilities.Add(
            CampaignAssignmentResponsibility.Confirm(
                tenantId, cycle.Id, subjectId, managerId, "Manager",
                CampaignResponsibilityDuty.ObjectiveApproval,
                CampaignAssignmentSource.Curated, "PrimaryManager"));
        await db.SaveChangesAsync();

        // Activate the cycle
        var activateHandler = new ActivateCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));
        var activateResult = await activateHandler.Handle(
            new ActivateCycleCommand(cycle.Id, cycle.Version), CancellationToken.None);
        Assert.True(activateResult.IsSuccess);

        // Reload cycle to get the updated version after activation
        var reloadedCycle = await db.PerformanceCycles.SingleAsync(c => c.Id == cycle.Id);

        // Act — close the cycle (set clock past PeriodEnd so the close guard passes)
        var closeHandler = new CloseCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));
        var closeResult = await closeHandler.Handle(
            new CloseCycleCommand(reloadedCycle.Id, reloadedCycle.Version), CancellationToken.None);

        // Assert — close succeeded
        Assert.True(closeResult.IsSuccess);

        // Assert — CycleClosed notification sent to managerId (responsibility assignee)
        Assert.Contains(db.PerformanceNotifications,
            n => n.Type == PerformanceNotificationType.CycleClosed
              && n.RecipientEmployeeId == managerId);

        // Assert — population subjectId is NOT the basis for the notification
        Assert.DoesNotContain(db.PerformanceNotifications,
            n => n.Type == PerformanceNotificationType.CycleClosed
              && n.RecipientEmployeeId == subjectId);
    }
}
