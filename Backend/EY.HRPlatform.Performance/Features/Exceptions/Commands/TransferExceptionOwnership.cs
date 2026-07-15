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

public sealed record TransferExceptionOwnershipCommand(
    Guid CycleId,
    Guid ExceptionCaseId,
    Guid NewOwnerEmployeeId,
    string Reason) : ICommand<Result<ExceptionCaseDto>>;

public sealed class TransferExceptionOwnershipCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : ICommandHandler<TransferExceptionOwnershipCommand, Result<ExceptionCaseDto>>
{
    public async Task<Result<ExceptionCaseDto>> Handle(TransferExceptionOwnershipCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<ExceptionCaseDto>(Error.Forbidden("Exception.EmployeeContextRequired", "An employee context is required."));

        var cycle = await dbContext.PerformanceCycles
            .Include(item => item.ExceptionOwners)
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
            return Result.Failure<ExceptionCaseDto>(Error.Forbidden("Exception.TransferForbidden", "The current actor cannot transfer this exception case."));

        var previousOwnerId = exceptionCase.CurrentOwnerEmployeeId;
        exceptionCase.TransferOwnership(request.NewOwnerEmployeeId, currentUser.EmployeeId.Value, request.Reason, DateTime.UtcNow);
        dbContext.ExceptionCaseHistoryEntries.Add(ExceptionCaseHistoryEntry.Create(
            exceptionCase.TenantId,
            exceptionCase.Id,
            "Transferred",
            previousOwnerId,
            request.NewOwnerEmployeeId,
            ExceptionResolutionAction.Transfer,
            currentUser.EmployeeId.Value,
            request.Reason,
            "Transferred",
            DateTime.UtcNow));

        var activeResolutionTask = await dbContext.CampaignWorkItems
            .FirstOrDefaultAsync(item => item.Id == exceptionCase.CurrentResolutionWorkItemId, cancellationToken);
        if (activeResolutionTask is not null && activeResolutionTask.Status is not (CampaignWorkItemStatus.Cancelled or CampaignWorkItemStatus.Completed))
            activeResolutionTask.Cancel();

        var replacementTask = CampaignWorkItem.Create(
            exceptionCase.TenantId,
            exceptionCase.CycleId,
            exceptionCase.SourceObjectId,
            request.NewOwnerEmployeeId,
            CampaignWorkItemType.ExceptionResolution,
            activeResolutionTask?.DueAt ?? cycle.PeriodEnd);
        replacementTask.LinkToExceptionCase(exceptionCase.Id);
        exceptionCase.AttachResolutionWorkItem(replacementTask.Id);
        dbContext.CampaignWorkItems.Add(replacementTask);

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.ExceptionOwnershipTransferred,
            currentUser.UserId,
            currentUser.FullName,
            $"Transferred exception case {exceptionCase.Id} from {previousOwnerId} to {request.NewOwnerEmployeeId}."));

        var recipients = cycle.ExceptionOwners.Select(item => item.EmployeeId)
            .Append(previousOwnerId)
            .Append(request.NewOwnerEmployeeId);
        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForExceptionCase(
                cycle,
                exceptionCase.Id,
                PerformanceNotificationType.ExceptionTransferred,
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
