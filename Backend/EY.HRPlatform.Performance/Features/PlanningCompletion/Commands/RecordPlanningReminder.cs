using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Commands;

public sealed record RecordPlanningReminderCommand(
    Guid CycleId,
    RecordPlanningReminderRequest Request) : ICommand<Result<PlanningCompletionParticipantDetailDto>>;

public sealed class RecordPlanningReminderCommandHandler(
    PerformanceDbContext dbContext,
    PlanningCompletionReadService readService,
    ICurrentUserContext currentUser)
    : ICommandHandler<RecordPlanningReminderCommand, Result<PlanningCompletionParticipantDetailDto>>
{
    public async Task<Result<PlanningCompletionParticipantDetailDto>> Handle(
        RecordPlanningReminderCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Request.Reason))
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.ReminderReasonRequired", "A reminder reason is required."));
        if (request.Request.TargetEmployeeId == Guid.Empty)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.ReminderTargetRequired", "A reminder target is required."));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.Launched)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Validation("PlanningCompletion.NotLaunchedInvalid", "Planning completion starts after campaign launch."));
        if (cycle.IsPlanningLocked)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.Conflict("PlanningCompletion.Locked", "Planning is locked for this campaign."));

        var participantEmployeeId = request.Request.ParticipantEmployeeId ?? request.Request.TargetEmployeeId;
        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == request.CycleId && item.EmployeeId == participantEmployeeId,
                cancellationToken);
        if (participant is null)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.NotFound("PerformanceCycleParticipant", participantEmployeeId));

        var allowedTargetIds = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId)
            .Select(item => new { item.EmployeeId, item.ApproverEmployeeId })
            .ToListAsync(cancellationToken);
        var reassignedReviewerIds = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId)
            .Select(item => item.NewApproverEmployeeId)
            .ToListAsync(cancellationToken);
        var targetIsInCampaignContext = allowedTargetIds.Any(item =>
                item.EmployeeId == request.Request.TargetEmployeeId
                || item.ApproverEmployeeId == request.Request.TargetEmployeeId)
            || reassignedReviewerIds.Contains(request.Request.TargetEmployeeId);
        if (!targetIsInCampaignContext)
            return Result.Failure<PlanningCompletionParticipantDetailDto>(
                Error.NotFound("PlanningReminderTarget", request.Request.TargetEmployeeId));

        var targetName = await ResolveTargetNameAsync(request.Request.TargetEmployeeId, request.CycleId, cancellationToken);
        var notificationTriggered = false;
        if (request.Request.TriggerNotification)
        {
            dbContext.PerformanceNotifications.Add(PerformanceNotification.Create(
                cycle.TenantId,
                request.Request.TargetEmployeeId,
                PerformanceNotificationType.PlanningReminder,
                "Planning follow-up",
                request.Request.Reason.Trim(),
                cycle.Id,
                dedupKey: $"{cycle.Id}:planning-reminder:{request.Request.TargetEmployeeId}:{DateTime.UtcNow:yyyyMMddHHmmss}",
                subjectType: "PerformanceCycle",
                subjectId: cycle.Id,
                navigationRoute: $"/campaigns/{cycle.Slug}/completion"));
            notificationTriggered = true;
        }

        var reminder = PerformancePlanningReminder.Create(
            cycle.TenantId,
            cycle.Id,
            participant.EmployeeId,
            request.Request.PlanId,
            request.Request.TargetEmployeeId,
            targetName,
            string.IsNullOrWhiteSpace(request.Request.TargetType) ? "Participant" : request.Request.TargetType,
            request.Request.Reason,
            currentUser.UserId,
            currentUser.FullName,
            DateTime.UtcNow,
            notificationTriggered);

        dbContext.PerformancePlanningReminders.Add(reminder);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            notificationTriggered
                ? PerformanceCycleAuditAction.PlanningReminderTriggered
                : PerformanceCycleAuditAction.PlanningReminderRecorded,
            currentUser.UserId,
            currentUser.FullName,
            $"Recorded planning reminder for '{targetName}'.",
            correlationId: currentUser.CorrelationId));

        await dbContext.SaveChangesAsync(cancellationToken);
        return await readService.GetParticipantDetailAsync(cycle.Id, participant.EmployeeId, cancellationToken);
    }

    private async Task<string> ResolveTargetNameAsync(
        Guid targetEmployeeId,
        Guid cycleId,
        CancellationToken cancellationToken)
    {
        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CycleId == cycleId && item.EmployeeId == targetEmployeeId, cancellationToken);
        if (participant is not null)
            return participant.FullName;

        var reassignment = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.CycleId == cycleId && item.NewApproverEmployeeId == targetEmployeeId)
            .OrderByDescending(item => item.ReassignedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return reassignment?.NewApproverName ?? "Selected reviewer";
    }
}
