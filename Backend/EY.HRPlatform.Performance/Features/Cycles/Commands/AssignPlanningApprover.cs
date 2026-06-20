using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record AssignPlanningApproverCommand(
    Guid CycleId,
    Guid ParticipantId,
    uint ExpectedVersion,
    Guid ApproverEmployeeId,
    string Reason) : ICommand<Result<CycleParticipantDto>>;

public sealed class AssignPlanningApproverCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    ICoreWorkforceClient workforceClient)
    : ICommandHandler<AssignPlanningApproverCommand, Result<CycleParticipantDto>>
{
    public async Task<Result<CycleParticipantDto>> Handle(
        AssignPlanningApproverCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(current => current.Participants)
            .FirstOrDefaultAsync(current => current.Id == request.CycleId, cancellationToken);
        if (cycle is null)
        {
            return Result.Failure<CycleParticipantDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var participant = cycle.Participants.SingleOrDefault(current => current.Id == request.ParticipantId);
        if (participant is null)
        {
            return Result.Failure<CycleParticipantDto>(Error.NotFound("PerformanceCycleParticipant", request.ParticipantId));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        var approver = (await workforceClient.ResolveEmployeesAsync([request.ApproverEmployeeId], cancellationToken))
            .SingleOrDefault(current => current.EmployeeId == request.ApproverEmployeeId && current.IsActive);
        if (approver is null)
        {
            return Result.Failure<CycleParticipantDto>(
                Error.Validation("Cycle.InvalidPlanningApprover", "The selected planning approver is unavailable or not visible in the current workforce scope."));
        }

        participant.AssignPlanningApprover(
            approver.EmployeeId,
            string.IsNullOrWhiteSpace(approver.DisplayName) ? approver.FullName : approver.DisplayName,
            request.Reason);
        cycle.RecordPlanningApproverChange();

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.PlanningApproverAssigned,
            currentUser.UserId,
            currentUser.FullName,
            $"Assigned {approver.DisplayName} as planning approver for {participant.FullName}. Reason: {request.Reason.Trim()}"));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return CycleMapper.ToParticipantDto(participant);
    }
}
