using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record ApplyWorkforceDeltaCommand(
    Guid CycleId,
    uint ExpectedVersion,
    IReadOnlyList<WorkforceDeltaDecision> Decisions)
    : ICommand<Result<ApplyWorkforceDeltaResultDto>>;

public sealed class ApplyWorkforceDeltaCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser)
    : ICommandHandler<ApplyWorkforceDeltaCommand, Result<ApplyWorkforceDeltaResultDto>>
{
    public async Task<Result<ApplyWorkforceDeltaResultDto>> Handle(
        ApplyWorkforceDeltaCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .SingleOrDefaultAsync(x => x.Id == request.CycleId, cancellationToken);

        if (cycle is null)
            return Result.Failure<ApplyWorkforceDeltaResultDto>(
                Error.NotFound("PerformanceCycle", request.CycleId));

        if (cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure<ApplyWorkforceDeltaResultDto>(
                Error.Conflict("Cycle.NotActive", "Workforce delta can only be applied to an active campaign."));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        var appliedCount = 0;
        var rejectedCount = 0;

        foreach (var decision in request.Decisions)
        {
            var responsibility = await dbContext.CampaignAssignmentResponsibilities
                .SingleOrDefaultAsync(
                    x => x.CycleId == request.CycleId
                      && x.SubjectEmployeeId == decision.SubjectEmployeeId
                      && x.AssigneeEmployeeId == decision.AssigneeEmployeeId,
                    cancellationToken);

            if (responsibility is null)
                continue;

            if (decision.Accept)
            {
                appliedCount++;
                dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                    tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.WorkforceDeltaApplied,
                    currentUser.UserId, currentUser.FullName,
                    $"Delta accepted for subject {decision.SubjectEmployeeId}, assignee {decision.AssigneeEmployeeId}."));
            }
            else
            {
                rejectedCount++;
                dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                    tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.WorkforceDeltaRejected,
                    currentUser.UserId, currentUser.FullName,
                    $"Delta rejected for subject {decision.SubjectEmployeeId}, assignee {decision.AssigneeEmployeeId}."));
            }
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return Result.Success(new ApplyWorkforceDeltaResultDto(appliedCount, rejectedCount));
    }
}
