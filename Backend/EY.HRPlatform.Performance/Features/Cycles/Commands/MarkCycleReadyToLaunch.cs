using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
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

public sealed record MarkCycleReadyToLaunchCommand(Guid CycleId, uint ExpectedVersion, bool AcceptCurrentWorkforceDelta)
    : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class MarkCycleReadyToLaunchCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    ICoreWorkforceClient workforceClient,
    IOptions<ReminderOptions> reminderOptions)
    : ICommandHandler<MarkCycleReadyToLaunchCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(MarkCycleReadyToLaunchCommand request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles.Include(x => x.Participants)
            .SingleOrDefaultAsync(x => x.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.AssignmentPreparation)
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict("Cycle.NotInPreparation", "Only a campaign in assignment preparation can be marked ready."));

        // Coverage and the workforce delta come from the same responsibility read model that powers
        // the readiness screen, so the launch gate validates exactly what the operator reviewed.
        var readModel = await CampaignResponsibilityReadModel.LoadAsync(dbContext, cycle.Id, "all", cancellationToken);
        if (readModel.IsFailure)
            return Result.Failure<PerformanceCycleDetailDto>(readModel.Error);

        var failures = readModel.Value.MissingObjectiveResponsibilityCount;

        var delta = await CampaignWorkforceDeltaResolver.ComputeAsync(
            readModel.Value.Items.Where(x => x.CurrentResponsibility is not null).ToList(),
            workforceClient,
            cancellationToken);
        if (delta.BlocksLaunch)
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict(
                "Cycle.WorkforceDeltaBlocksLaunch",
                $"{delta.InactiveOrMissingAssigneeCount} final approver assignment(s) are no longer valid in the current workforce. Re-curate those responsibilities before launch."));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);
        try
        {
            cycle.MarkReadyToLaunch(
                readModel.Value.ConfirmedObjectiveResponsibilityCount,
                failures,
                request.AcceptCurrentWorkforceDelta,
                DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict("Cycle.NotReady", exception.Message));
        }

        var deltaNote = delta.Items.Count > 0
            ? $" Accepted workforce delta: {delta.Items.Count} current workforce change(s)."
            : " No workforce changes since preparation.";
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.ReadyToLaunch,
            currentUser.UserId, currentUser.FullName,
            $"Final responsibilities confirmed and current workforce delta accepted.{deltaNote}"));
        await dbContext.SaveChangesAsync(cancellationToken);
        return CycleMapper.ToDetail(cycle, cycle.Participants.Count, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}
