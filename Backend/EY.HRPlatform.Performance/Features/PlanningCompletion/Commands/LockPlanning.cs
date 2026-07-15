using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Commands;

public sealed record LockPlanningCommand(
    Guid CycleId,
    uint ExpectedVersion,
    LockPlanningRequest Request) : ICommand<Result<PlanningCompletionWorkspaceDto>>;

public sealed class LockPlanningCommandHandler(
    PerformanceDbContext dbContext,
    PlanningCompletionReadService readService,
    ICurrentUserContext currentUser)
    : ICommandHandler<LockPlanningCommand, Result<PlanningCompletionWorkspaceDto>>
{
    public async Task<Result<PlanningCompletionWorkspaceDto>> Handle(
        LockPlanningCommand request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(request.Request.Confirmation?.Trim(), "LOCK", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<PlanningCompletionWorkspaceDto>(
                Error.Validation("PlanningCompletion.LockConfirmationRequired", "Type LOCK to confirm planning lock."));

        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PlanningCompletionWorkspaceDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(Domain.Entities.PerformanceCycle), cycle.Id);

        var remaining = await readService.ValidateLockReadinessAsync(cycle.Id, cancellationToken);
        if (remaining.IsFailure)
            return Result.Failure<PlanningCompletionWorkspaceDto>(remaining.Error);

        if (remaining.Value.Count > 0)
        {
            dbContext.PerformanceCycleAuditEvents.Add(Domain.Entities.PerformanceCycleAuditEvent.Create(
                cycle.TenantId,
                cycle.Id,
                PerformanceCycleAuditAction.PlanningLockRejected,
                currentUser.UserId,
                currentUser.FullName,
                $"Planning lock refused: {string.Join(", ", remaining.Value.Select(item => $"{item.Label} ({item.Count})"))}.",
                outcome: "Rejected",
                correlationId: currentUser.CorrelationId));
            await dbContext.SaveChangesAsync(cancellationToken);

            return Result.Failure<PlanningCompletionWorkspaceDto>(
                Error.Conflict("PlanningCompletion.NotReadyToLock", "Planning cannot be locked until every participant is approved or excluded."));
        }

        try
        {
            cycle.LockPlanning(currentUser.UserId, currentUser.FullName, DateTime.UtcNow);
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<PlanningCompletionWorkspaceDto>(
                Error.Conflict("PlanningCompletion.LockInvalid", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(Domain.Entities.PerformanceCycleAuditEvent.Create(
            cycle.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.PlanningLocked,
            currentUser.UserId,
            currentUser.FullName,
            "Locked planning baseline for P2 handoff.",
            correlationId: currentUser.CorrelationId));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(Domain.Entities.PerformanceCycle), cycle.Id);
        }

        return await readService.GetWorkspaceAsync(cycle.Slug, null, null, null, null, null, null, 1, 50, cancellationToken);
    }
}
