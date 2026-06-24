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

public sealed record CloseCycleCommand(Guid CycleId, uint ExpectedVersion) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class CloseCycleCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<CloseCycleCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        CloseCycleCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        if (cycle.Status != PerformanceCycleStatus.Active)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.NotActive", "Only an active campaign can be closed."));
        }

        var hasOpenExceptions = await dbContext.ExceptionCases
            .AnyAsync(item => item.CycleId == request.CycleId && item.Status == ExceptionCaseStatus.Open, cancellationToken);
        if (hasOpenExceptions)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.OpenExceptionsBlockClose", "The campaign cannot close while exception cases remain open."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

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
