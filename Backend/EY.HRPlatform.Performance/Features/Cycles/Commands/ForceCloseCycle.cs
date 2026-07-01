using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
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

public sealed record ForceCloseCycleCommand(
    Guid CycleId,
    uint ExpectedVersion,
    IReadOnlyList<ForceCloseExceptionDecisionDto> Decisions) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class ForceCloseCycleCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<ForceCloseCycleCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(ForceCloseCycleCommand request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanOverrideException(httpContextAccessor.HttpContext!.User))
            return Result.Failure<PerformanceCycleDetailDto>(Error.Forbidden("Cycle.ForceCloseForbidden", "Force-close requires elevated exception authority."));

        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict("Cycle.NotActive", "Only an active campaign can be closed."));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        var openCases = await dbContext.ExceptionCases
            .Where(item => item.CycleId == request.CycleId && item.Status == ExceptionCaseStatus.Open)
            .ToListAsync(cancellationToken);

        if (openCases.Count != request.Decisions.Count)
            return Result.Failure<PerformanceCycleDetailDto>(Error.Validation("Cycle.ForceCloseDecisionsMismatch", "Provide one explicit force-close decision for every open exception case."));

        foreach (var item in openCases)
        {
            var decision = request.Decisions.FirstOrDefault(entry => entry.ExceptionCaseId == item.Id);
            if (decision is null)
                return Result.Failure<PerformanceCycleDetailDto>(Error.Validation("Cycle.ForceCloseDecisionMissing", $"Missing decision for exception case {item.Id}."));
            if (decision.Action is not (ExceptionResolutionAction.Override or ExceptionResolutionAction.Cancel))
                return Result.Failure<PerformanceCycleDetailDto>(Error.Validation("Cycle.ForceCloseActionInvalid", "Force-close supports only Override or Cancel decisions."));

            var resolutionTask = await dbContext.CampaignWorkItems.FirstOrDefaultAsync(entry => entry.Id == item.CurrentResolutionWorkItemId, cancellationToken);
            if (resolutionTask is not null && resolutionTask.Status is not (CampaignWorkItemStatus.Cancelled or CampaignWorkItemStatus.Completed))
                resolutionTask.Cancel();

            item.ForceClose(decision.Action, currentUser.EmployeeId ?? Guid.NewGuid(), decision.Reason, DateTime.UtcNow);
            dbContext.ExceptionCaseHistoryEntries.Add(ExceptionCaseHistoryEntry.Create(
                item.TenantId,
                item.Id,
                "ForceClosed",
                item.CurrentOwnerEmployeeId,
                item.CurrentOwnerEmployeeId,
                decision.Action,
                currentUser.EmployeeId ?? Guid.NewGuid(),
                decision.Reason,
                "ForceClosed",
                DateTime.UtcNow));
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                cycle.TenantId,
                cycle.Id,
                PerformanceCycleAuditAction.ExceptionForceClosed,
                currentUser.UserId,
                currentUser.FullName,
                $"Force-closed exception case {item.Id} via {decision.Action}."));
        }

        cycle.Close(DateTime.UtcNow);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.Closed, currentUser.UserId, currentUser.FullName));

        var workItemAssignees = await dbContext.CampaignWorkItems
            .Where(wi => wi.CycleId == request.CycleId && wi.Type != CampaignWorkItemType.ObjectivePlanning)
            .Select(wi => wi.AssigneeEmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken);
        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForLifecycle(cycle, PerformanceNotificationType.CycleClosed, workItemAssignees));

        await dbContext.SaveChangesAsync(cancellationToken);
        return CycleMapper.ToDetail(cycle, cycle.Participants.Count, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}
