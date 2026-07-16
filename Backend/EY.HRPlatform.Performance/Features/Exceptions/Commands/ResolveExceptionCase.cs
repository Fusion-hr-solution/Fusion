using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Exceptions.Dtos;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Exceptions.Commands;

public sealed record ResolveExceptionCaseCommand(
    Guid CycleId,
    Guid ExceptionCaseId,
    ExceptionResolutionAction Action,
    string Reason,
    Guid? ReassignToEmployeeId = null) : ICommand<Result<ExceptionCaseDto>>;

public sealed class ResolveExceptionCaseCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : ICommandHandler<ResolveExceptionCaseCommand, Result<ExceptionCaseDto>>
{
    public async Task<Result<ExceptionCaseDto>> Handle(ResolveExceptionCaseCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<ExceptionCaseDto>(Error.Forbidden("Exception.EmployeeContextRequired", "An employee context is required."));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<ExceptionCaseDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        var exceptionCase = await dbContext.ExceptionCases
            .FirstOrDefaultAsync(item => item.Id == request.ExceptionCaseId && item.CycleId == request.CycleId, cancellationToken);
        if (exceptionCase is null)
            return Result.Failure<ExceptionCaseDto>(Error.NotFound("ExceptionCase", request.ExceptionCaseId));

        var canOverride = accessPolicy.CanOverrideException(httpContextAccessor.HttpContext!.User);
        var canActAsOwner = accessPolicy.CanActOnOwnedException(httpContextAccessor.HttpContext!.User)
            && exceptionCase.CurrentOwnerEmployeeId == currentUser.EmployeeId.Value;
        if (!canOverride && !canActAsOwner)
            return Result.Failure<ExceptionCaseDto>(Error.Forbidden("Exception.ResolveForbidden", "The current actor cannot resolve this exception case."));

        var activeResolutionTask = await dbContext.CampaignWorkItems
            .FirstOrDefaultAsync(item => item.Id == exceptionCase.CurrentResolutionWorkItemId, cancellationToken);
        if (activeResolutionTask is not null && activeResolutionTask.Status is not (CampaignWorkItemStatus.Cancelled or CampaignWorkItemStatus.Completed))
            activeResolutionTask.Cancel();

        var action = request.Action;
        if (action == ExceptionResolutionAction.Transfer)
            return Result.Failure<ExceptionCaseDto>(Error.Validation("Exception.InvalidAction", "Transfer must use the ownership-transfer command."));

        if (action == ExceptionResolutionAction.Reassign)
        {
            if (!request.ReassignToEmployeeId.HasValue)
                return Result.Failure<ExceptionCaseDto>(Error.Validation("Exception.ReassignTargetRequired", "Reassign requires a target employee."));

            var replacementTask = CampaignWorkItem.Create(
                exceptionCase.TenantId,
                exceptionCase.CycleId,
                exceptionCase.SourceObjectId,
                request.ReassignToEmployeeId.Value,
                exceptionCase.SourceWorkItemType,
                activeResolutionTask?.DueAt ?? cycle.PeriodEnd);
            dbContext.CampaignWorkItems.Add(replacementTask);
        }

        exceptionCase.Resolve(action, currentUser.EmployeeId.Value, request.Reason, DateTime.UtcNow);
        dbContext.ExceptionCaseHistoryEntries.Add(ExceptionCaseHistoryEntry.Create(
            exceptionCase.TenantId,
            exceptionCase.Id,
            "Resolved",
            exceptionCase.CurrentOwnerEmployeeId,
            exceptionCase.CurrentOwnerEmployeeId,
            action,
            currentUser.EmployeeId.Value,
            request.Reason,
            action.ToString(),
            DateTime.UtcNow));
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            action switch
            {
                ExceptionResolutionAction.Reassign => PerformanceCycleAuditAction.ExceptionReassigned,
                ExceptionResolutionAction.Override => PerformanceCycleAuditAction.ExceptionOverridden,
                ExceptionResolutionAction.Return => PerformanceCycleAuditAction.ExceptionReturned,
                ExceptionResolutionAction.Cancel => PerformanceCycleAuditAction.ExceptionCancelled,
                _ => PerformanceCycleAuditAction.ExceptionCancelled
            },
            currentUser.UserId,
            currentUser.FullName,
            $"Resolved exception case {exceptionCase.Id} via {action}."));

        var recipients = new[] { exceptionCase.CurrentOwnerEmployeeId };
        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForExceptionCase(
                cycle,
                exceptionCase.Id,
                PerformanceNotificationType.ExceptionResolved,
                recipients,
                exceptionCase.SourceWorkItemType.ToString()));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(exceptionCase));
    }

    private static ExceptionCaseDto ToDto(ExceptionCase item)
        => new(
            item.Id,
            item.CycleId,
            item.SourceWorkItemId,
            item.SourceWorkItemType.ToString(),
            item.SourceObjectId,
            item.CurrentOwnerEmployeeId,
            item.Status.ToString(),
            item.FrozenReason,
            item.FailureCode,
            item.OpenedAt,
            item.ResolvedAt,
            item.CurrentResolutionWorkItemId,
            item.PreviousCaseId,
            item.ResolutionAction?.ToString());
}
