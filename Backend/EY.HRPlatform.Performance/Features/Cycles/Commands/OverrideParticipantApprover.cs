using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record OverrideParticipantApproverCommand(
    Guid CycleId,
    uint ExpectedVersion,
    Guid ParticipantEmployeeId,
    Guid ApproverEmployeeId,
    string Reason) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class OverrideParticipantApproverCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    ICoreWorkforceClient workforceClient,
    IOptions<ReminderOptions> reminderOptions)
    : ICommandHandler<OverrideParticipantApproverCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        OverrideParticipantApproverCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Cycle.ApproverReasonRequired", "An override reason is required."));
        }

        if (request.ApproverEmployeeId == Guid.Empty)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Cycle.ApproverRequired", "An approver is required."));
        }

        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.ApproverOverrides)
            .Include(c => c.PopulationRules)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        // The override target must be an active Core employee in the acting tenant.
        var resolved = await workforceClient.ResolveEmployeesAsync([request.ApproverEmployeeId], cancellationToken);
        var approver = resolved.FirstOrDefault(employee => employee.EmployeeId == request.ApproverEmployeeId);
        if (approver is null || !approver.IsActive)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Cycle.InvalidApprover", "The selected approver is not an active employee in this tenant."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        var approverName = string.IsNullOrWhiteSpace(approver.DisplayName) ? approver.FullName : approver.DisplayName;

        try
        {
            cycle.OverrideApprover(request.ParticipantEmployeeId, request.ApproverEmployeeId, approverName, request.Reason);
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.NotDraft", exception.Message));
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Cycle.InvalidApproverOverride", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.ApproverOverridden,
            currentUser.UserId,
            currentUser.FullName,
            $"Approver for participant {request.ParticipantEmployeeId} set to {approverName}."));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return CycleMapper.ToDetail(cycle, 0, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}
