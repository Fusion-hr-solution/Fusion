using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// CycleActivated notifications must go to responsibility assignees (managerId),
/// NOT to population subjects (subjectId). This codifies the responsibility-driven
/// notification contract for activation.
/// </summary>
public sealed class ActivateCycleNotificationTests
{
    /// <summary>
    /// After activation, a CycleActivated notification is sent to the responsibility
    /// assignee (managerId) and NOT to the population subject (subjectId).
    /// </summary>
    [Fact(Skip = "RED test: activate handler does not emit notifications yet (Wave 2)")]
    public async Task ActivateCycle_SendsNotificationToAssignee_NotToSubject()
    {
        // Arrange — mirror ActivateCycleWorkItemTests setup
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

        // Act — activate the cycle
        var handler = new ActivateCycleCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));

        var result = await handler.Handle(
            new ActivateCycleCommand(cycle.Id, cycle.Version), CancellationToken.None);

        // Assert — activation succeeded
        Assert.True(result.IsSuccess);

        // Assert — CycleActivated notification sent to managerId (responsibility assignee)
        Assert.Contains(db.PerformanceNotifications,
            n => n.Type == PerformanceNotificationType.CycleActivated
              && n.RecipientEmployeeId == managerId);

        // Assert — CycleActivated notification NOT sent to subjectId (population subject)
        Assert.DoesNotContain(db.PerformanceNotifications,
            n => n.Type == PerformanceNotificationType.CycleActivated
              && n.RecipientEmployeeId == subjectId);
    }
}
