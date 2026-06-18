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

        if (cycle.Status is not (PerformanceCycleStatus.Published or PerformanceCycleStatus.Active))
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.NotClosable", "Only a published or active cycle can be closed."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        cycle.Close();

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.Closed, currentUser.UserId, currentUser.FullName));

        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForLifecycle(
                cycle,
                PerformanceNotificationType.CycleClosed,
                cycle.Participants.Select(p => p.EmployeeId)));

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
