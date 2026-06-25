using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record ActivateCycleCommand(Guid CycleId, uint ExpectedVersion) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class ActivateCycleCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<ActivateCycleCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        ActivateCycleCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.Participants)
            .Include(c => c.ExceptionOwners)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        if (cycle.Status != PerformanceCycleStatus.ReadyToLaunch)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.NotReadyToLaunch", "Only a ready-to-launch campaign can be activated."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        cycle.Activate(DateTime.UtcNow);

        // Activation is the only point at which preparation candidates become immutable campaign
        // context. Active work never reads mutable Core workforce facts.
        var activationTime = DateTime.UtcNow;
        var launchSnapshots = cycle.Participants
            .Select(candidate => CampaignLaunchParticipantSnapshot.FromPreparationCandidate(candidate, activationTime))
            .ToList();
        dbContext.CampaignLaunchParticipantSnapshots.AddRange(launchSnapshots);

        // Work is derived only from accepted final responsibility revisions and the launch
        // participant snapshot, never from a current population query.
        var responsibilityRevisions = await dbContext.CampaignAssignmentResponsibilities
            .Where(item => item.CycleId == cycle.Id && item.IsFinal)
            .ToListAsync(cancellationToken);
        var finalResponsibilities = responsibilityRevisions
            .GroupBy(item => new { item.SubjectEmployeeId, item.Duty })
            .Select(group => group.OrderByDescending(item => item.Revision).First())
            .ToList();
        var planningDueAt = cycle.ObjectiveSettingDeadline ?? cycle.PeriodEnd;
        var workItems = launchSnapshots
            .Select(participant => CampaignWorkItem.Create(
                tenantContext.TenantId, cycle.Id, participant.EmployeeId, participant.EmployeeId,
                CampaignWorkItemType.ObjectivePlanning, planningDueAt))
            .ToList();
        workItems.AddRange(finalResponsibilities.Select(responsibility => CampaignWorkItem.Create(
            tenantContext.TenantId,
            cycle.Id,
            responsibility.SubjectEmployeeId,
            responsibility.AssigneeEmployeeId,
            responsibility.Duty switch
            {
                CampaignResponsibilityDuty.ObjectiveApproval => CampaignWorkItemType.ObjectiveApproval,
                CampaignResponsibilityDuty.PeerFeedback => CampaignWorkItemType.PeerFeedback,
                CampaignResponsibilityDuty.UpwardFeedback => CampaignWorkItemType.UpwardFeedback,
                _ => CampaignWorkItemType.ManagerReview,
            },
            responsibility.Duty == CampaignResponsibilityDuty.ObjectiveApproval
                ? planningDueAt
                : cycle.PeriodEnd,
            responsibility.Id)));
        dbContext.CampaignWorkItems.AddRange(workItems);

        var activatedRecipientIds = workItems
            .Where(wi => wi.Type != CampaignWorkItemType.ObjectivePlanning)
            .Select(wi => wi.AssigneeEmployeeId)
            .Distinct()
            .ToList();
        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForLifecycle(cycle, PerformanceNotificationType.CycleActivated, activatedRecipientIds));

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.Activated, currentUser.UserId, currentUser.FullName));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return CycleMapper.ToDetail(cycle, cycle.Participants.Count, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}
