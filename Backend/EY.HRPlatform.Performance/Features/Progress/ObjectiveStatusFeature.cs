using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Progress;

public sealed record AcknowledgeObjectiveStatusCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor, uint ExpectedVersion)
    : ICommand<Result<GoalDetailDto>>;

/// <summary>
/// The plan's responsible reviewer acknowledges a report's At risk or Off track status (D-05). It clears their
/// attention item and shows the owner who saw it; the status itself is the owner's and stays unchanged.
/// </summary>
public sealed class AcknowledgeObjectiveStatusHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant,
    IPerformanceAudit audit, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<AcknowledgeObjectiveStatusCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(AcknowledgeObjectiveStatusCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null) return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        var plan = await GoalsComposer.LoadOwningPlanAsync(Db, objective, cancellationToken);
        if (plan is null || !PlanPolicy.CanRequestUpdate(command.Actor, plan, cycle))
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveStatusAcknowledgeForbidden,
                "Only the plan's responsible reviewer can acknowledge its objectives' status."));

        // A retry after success finds it already acknowledged and returns the record unchanged.
        if (objective.StatusAcknowledgedAt is not null && objective.StatusAcknowledgedByEmployeeId == command.Actor.CallerEmployeeId)
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

        try
        {
            if (objective.AcknowledgeStatus(command.Actor.CallerEmployeeId, DateTime.UtcNow))
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectiveStatusAcknowledged,
                    new { before = new { acknowledged = false }, after = new { acknowledged = true },
                        status = objective.CurrentStatus?.ToString(), since = objective.StatusSince });
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveStatusNotAcknowledgeable, ex.Message));
        }
    }
}
