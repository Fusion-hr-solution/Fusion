using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Exceptions.Services;

public sealed record OpenExceptionCaseRequest(
    Guid CycleId,
    Guid SourceWorkItemId,
    CampaignWorkItemType SourceWorkItemType,
    Guid SourceObjectId,
    string FrozenReason,
    string FailureCode,
    object FrozenWorkflowContext,
    DateTime DueAt);

public interface IExceptionCaseWorkflowService
{
    Task<ExceptionCase> OpenOrReuseAsync(OpenExceptionCaseRequest request, CancellationToken cancellationToken);
}

public sealed class ExceptionCaseWorkflowService(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IExceptionCaseWorkflowService
{
    public async Task<ExceptionCase> OpenOrReuseAsync(OpenExceptionCaseRequest request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken)
            ?? throw new InvalidOperationException($"Performance cycle {request.CycleId} was not found.");

        var workflowContextJson = JsonSerializer.Serialize(request.FrozenWorkflowContext);
        var actorEmployeeId = currentUser.EmployeeId
            ?? throw new InvalidOperationException($"Performance cycle {request.CycleId} has no acting employee for exception ownership.");
        var now = DateTime.UtcNow;

        var existingCase = await dbContext.ExceptionCases
            .FirstOrDefaultAsync(item =>
                item.CycleId == request.CycleId &&
                item.Status == ExceptionCaseStatus.Open &&
                item.SourceWorkItemId == request.SourceWorkItemId &&
                item.SourceObjectId == request.SourceObjectId &&
                item.FailureCode == request.FailureCode,
                cancellationToken);

        if (existingCase is not null)
        {
            existingCase.RecordDetection(
                actorEmployeeId,
                request.FrozenReason,
                "Reused existing open case",
                now);
            dbContext.ExceptionCaseHistoryEntries.Add(ExceptionCaseHistoryEntry.Create(
                existingCase.TenantId,
                existingCase.Id,
                "Detected",
                existingCase.CurrentOwnerEmployeeId,
                existingCase.CurrentOwnerEmployeeId,
                null,
                actorEmployeeId,
                request.FrozenReason,
                "Reused existing open case",
                now));

            var activeResolutionTask = await dbContext.CampaignWorkItems
                .FirstOrDefaultAsync(item => item.Id == existingCase.CurrentResolutionWorkItemId, cancellationToken);

            if (activeResolutionTask is null || activeResolutionTask.Status is CampaignWorkItemStatus.Completed or CampaignWorkItemStatus.Cancelled)
            {
                var newTask = CreateResolutionTask(existingCase, request.DueAt);
                dbContext.CampaignWorkItems.Add(newTask);
                existingCase.AttachResolutionWorkItem(newTask.Id);
            }

            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                cycle.TenantId,
                cycle.Id,
                PerformanceCycleAuditAction.ExceptionOpened,
                currentUser.UserId,
                currentUser.FullName,
                $"Reused open exception case {existingCase.Id} for source work item {request.SourceWorkItemId}."));

            await dbContext.SaveChangesAsync(cancellationToken);
            return existingCase;
        }

        var exceptionCase = ExceptionCase.Create(
            cycle.TenantId,
            request.CycleId,
            request.SourceWorkItemId,
            request.SourceWorkItemType,
            request.SourceObjectId,
            actorEmployeeId,
            request.FrozenReason,
            request.FailureCode,
            workflowContextJson,
            now);

        exceptionCase.RecordDetection(actorEmployeeId, request.FrozenReason, "Opened new case", now);
        dbContext.ExceptionCaseHistoryEntries.Add(ExceptionCaseHistoryEntry.Create(
            exceptionCase.TenantId,
            exceptionCase.Id,
            "Detected",
            exceptionCase.CurrentOwnerEmployeeId,
            exceptionCase.CurrentOwnerEmployeeId,
            null,
            actorEmployeeId,
            request.FrozenReason,
            "Opened new case",
            now));

        var resolutionTask = CreateResolutionTask(exceptionCase, request.DueAt);
        exceptionCase.AttachResolutionWorkItem(resolutionTask.Id);

        dbContext.ExceptionCases.Add(exceptionCase);
        dbContext.CampaignWorkItems.Add(resolutionTask);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.ExceptionOpened,
            currentUser.UserId,
            currentUser.FullName,
            $"Opened exception case {exceptionCase.Id} for source work item {request.SourceWorkItemId}."));

        var recipients = new[] { actorEmployeeId };
        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForExceptionCase(
                cycle,
                exceptionCase.Id,
                PerformanceNotificationType.ExceptionOpened,
                recipients,
                request.SourceWorkItemType.ToString()));

        await dbContext.SaveChangesAsync(cancellationToken);
        return exceptionCase;
    }

    private static CampaignWorkItem CreateResolutionTask(ExceptionCase exceptionCase, DateTime dueAt)
    {
        var workItem = CampaignWorkItem.Create(
            exceptionCase.TenantId,
            exceptionCase.CycleId,
            exceptionCase.SourceObjectId,
            exceptionCase.CurrentOwnerEmployeeId,
            CampaignWorkItemType.ExceptionResolution,
            dueAt);
        workItem.LinkToExceptionCase(exceptionCase.Id);
        return workItem;
    }
}
