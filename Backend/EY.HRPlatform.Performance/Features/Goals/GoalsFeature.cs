using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Goals;

/// <summary>
/// The caller's contextual authorization inputs for organizational-goal actions, resolved once by
/// the controller from the token. Capability flags come from claims; the concrete contextual checks
/// (parent-accountable, objective-accountable) are resolved here against Performance data. There is
/// no tenant-admin override for organizational-objective approval (design Decision 4).
/// </summary>
public sealed record GoalActorContext(Guid CallerEmployeeId, bool IsAdmin, bool CanPublishStrategy);

public sealed record GetGoalsOverviewQuery(Guid CycleId, GoalActorContext Actor) : IQuery<Result<GoalsOverviewDto>>;
public sealed record GetGoalDetailQuery(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : IQuery<Result<GoalDetailDto>>;
public sealed record CreateOrganizationalObjectiveCommand(Guid CycleId, CreateOrganizationalObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record UpdateOrganizationalObjectiveCommand(Guid CycleId, Guid ObjectiveId, UpdateOrganizationalObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record AlignObjectiveCommand(Guid CycleId, Guid ObjectiveId, AlignObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record SubmitObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record ApproveObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record ReturnObjectiveCommand(Guid CycleId, Guid ObjectiveId, ReturnObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record ConfigureContributionCommand(Guid CycleId, Guid ObjectiveId, ConfigureContributionRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record LockContributionCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record DeleteObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : ICommand<Result<bool>>;

// ── Queries ──────────────────────────────────────────────────────────────────

public sealed class GetGoalsOverviewHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetGoalsOverviewQuery, Result<GoalsOverviewDto>>
{
    public async Task<Result<GoalsOverviewDto>> Handle(GetGoalsOverviewQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<GoalsOverviewDto>(Error.NotFound("Cycle", request.CycleId));

        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        return GoalsComposer.BuildOverview(cycle, graph);
    }
}

public sealed class GetGoalDetailHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetGoalDetailQuery, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(GetGoalDetailQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Cycle", request.CycleId));

        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        var target = graph.ById.GetValueOrDefault(request.ObjectiveId);
        if (target is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", request.ObjectiveId));

        return GoalsComposer.BuildDetail(target, graph, request.Actor);
    }
}

// ── Command base (shared load + authorization + detail projection) ─────────────

public abstract class GoalCommandHandlerBase(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
{
    protected PerformanceDbContext Db => db;
    protected ITenantContext Tenant => tenant;

    protected async Task<Result<PerformanceCycle>> LoadOpenCycleAsync(Guid cycleId, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PerformanceCycle>(Error.NotFound("Cycle", cycleId));
        if (cycle.IsClosed)
            return Result.Failure<PerformanceCycle>(Error.Conflict("Cycle.Closed", "A Closed Cycle is read-only; objective planning is not available."));
        return Result.Success(cycle);
    }

    protected Task<Objective?> LoadTrackedAsync(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
        => db.Objectives
            .Include(o => o.ContributionLinks)
            .Include(o => o.Decisions)
            .FirstOrDefaultAsync(o => o.Id == objectiveId && o.CycleId == cycleId, cancellationToken);

    protected async Task<Result<GoalDetailDto>> ProjectAsync(PerformanceCycle cycle, Guid objectiveId, GoalActorContext actor, CancellationToken cancellationToken)
    {
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        var node = graph.ById.GetValueOrDefault(objectiveId);
        if (node is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", objectiveId));
        return GoalsComposer.BuildDetail(node, graph, actor);
    }
}

// ── Create ─────────────────────────────────────────────────────────────────

public sealed class CreateOrganizationalObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<CreateOrganizationalObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(CreateOrganizationalObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;
        var request = command.Request;

        var parent = await Db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == request.ParentObjectiveId, cancellationToken);
        if (parent is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("ParentObjective", request.ParentObjectiveId));
        if (parent.CycleId != cycle.Id)
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Alignment", "The parent objective belongs to a different Cycle."));
        if (!parent.IsAlignmentBaseline)
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.ParentNotBaseline", "You can only align to a published or approved objective."));

        // Creation authority (design Decision 4): admin, parent-accountable, or strategy owner for the first tier.
        if (!CanCreateUnder(parent, command.Actor))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.CreateForbidden", "You are not authorized to create an objective under this parent."));

        try
        {
            var measurement = request.ProgressSource == ObjectiveProgressSource.Direct && request.Measurement is not null
                ? PerformanceMappers.ToMeasurement(request.Measurement, Tenant.TenantId)
                : null;

            var objective = Objective.CreateOrganizational(
                Tenant.TenantId,
                cycle.Id,
                request.OrgUnitId,
                request.OrgUnitName,
                request.Title,
                request.Description,
                request.AccountablePersonId,
                request.ParentObjectiveId,
                request.StartDate ?? parent.StartDate,
                request.EndDate ?? parent.EndDate,
                request.ProgressSource,
                measurement,
                parent.StartDate,
                parent.EndDate,
                cycle.StartDate,
                cycle.EndDate);

            Db.Objectives.Add(objective);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Invalid", ex.Message));
        }
    }

    internal static bool CanCreateUnder(Objective parent, GoalActorContext actor)
        => actor.IsAdmin
            || parent.AccountablePersonId == actor.CallerEmployeeId
            || (parent.OwnershipScope == ObjectiveOwnershipScope.Company && actor.CanPublishStrategy);
}

// ── Update / Align ─────────────────────────────────────────────────────────

public sealed class UpdateOrganizationalObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<UpdateOrganizationalObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(UpdateOrganizationalObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));
        if (!GoalsComposer.CanMaintain(objective, command.Actor))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        var parent = objective.ParentObjectiveId is null ? null
            : await Db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == objective.ParentObjectiveId, cancellationToken);
        if (parent is null)
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Alignment", "The parent objective is missing."));

        var request = command.Request;
        try
        {
            var measurement = request.ProgressSource == ObjectiveProgressSource.Direct && request.Measurement is not null
                ? PerformanceMappers.ToMeasurement(request.Measurement, Tenant.TenantId)
                : null;

            objective.UpdateOrganizationalDetails(
                request.Title,
                request.Description,
                request.AccountablePersonId,
                request.StartDate,
                request.EndDate,
                request.ProgressSource,
                measurement,
                parent.StartDate,
                parent.EndDate,
                cycle.StartDate,
                cycle.EndDate);

            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Invalid", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotEditable", ex.Message));
        }
    }
}

public sealed class AlignObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<AlignObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(AlignObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));
        if (!GoalsComposer.CanMaintain(objective, command.Actor))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        var newParentId = command.Request.ParentObjectiveId;
        var newParent = await Db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == newParentId, cancellationToken);
        if (newParent is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("ParentObjective", newParentId));
        if (newParent.CycleId != cycle.Id)
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Alignment", "The parent objective belongs to a different Cycle."));
        if (!newParent.IsAlignmentBaseline)
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.ParentNotBaseline", "You can only align to a published or approved objective."));

        // Reject a cycle: the new parent must not be the objective itself or one of its descendants.
        var wouldCycle = await GoalsComposer.CreatesCycleAsync(Db, cycle.Id, objective.Id, newParentId, cancellationToken);
        if (wouldCycle)
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Alignment", "That alignment would create a circular hierarchy."));

        try
        {
            objective.AlignTo(newParentId, newParent.StartDate, newParent.EndDate);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Invalid", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotEditable", ex.Message));
        }
    }
}

// ── Lifecycle: submit / approve / return ─────────────────────────────────────

public sealed class SubmitObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<SubmitObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(SubmitObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));
        if (!GoalsComposer.CanMaintain(objective, command.Actor))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.SubmitForbidden", "You are not authorized to submit this objective."));

        try
        {
            objective.Submit(command.Actor.CallerEmployeeId);
            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotSubmittable", ex.Message));
        }
    }
}

public sealed class ApproveObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<ApproveObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(ApproveObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));

        var decision = await GoalsComposer.CanDecideAsync(Db, objective, command.Actor, cancellationToken);
        if (!decision)
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.ApproveForbidden", "Only the accountable person of the aligned parent objective can approve it."));

        try
        {
            objective.Approve(command.Actor.CallerEmployeeId);
            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotApprovable", ex.Message));
        }
    }
}

public sealed class ReturnObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<ReturnObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(ReturnObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));

        var decision = await GoalsComposer.CanDecideAsync(Db, objective, command.Actor, cancellationToken);
        if (!decision)
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.ReturnForbidden", "Only the accountable person of the aligned parent objective can return it."));

        try
        {
            objective.Return(command.Actor.CallerEmployeeId, command.Request.Feedback);
            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Feedback", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotReturnable", ex.Message));
        }
    }
}

// ── Contribution baseline ────────────────────────────────────────────────────

public sealed class ConfigureContributionHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<ConfigureContributionCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(ConfigureContributionCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));
        if (!GoalsComposer.CanMaintain(objective, command.Actor))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        // A contributor must be an aligned child of this objective (alignment ≠ contribution, but a
        // contributor is necessarily aligned).
        var alignedChildIds = await Db.Objectives.AsNoTracking()
            .Where(o => o.ParentObjectiveId == objective.Id)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);

        var invalid = command.Request.Contributors.Select(c => c.ChildObjectiveId).Except(alignedChildIds).ToList();
        if (invalid.Count > 0)
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Contribution", "Only aligned children can be configured as contributors."));

        try
        {
            objective.ConfigureContribution(command.Request.Contributors.Select(c => (c.ChildObjectiveId, c.Weight)));
            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Contribution", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.Contribution", ex.Message));
        }
    }
}

public sealed class LockContributionHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<LockContributionCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(LockContributionCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));
        if (!GoalsComposer.CanMaintain(objective, command.Actor))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        var childIds = objective.ContributionLinks.Select(l => l.ChildObjectiveId).ToList();
        var approvedChildCount = await Db.Objectives.AsNoTracking()
            .CountAsync(o => childIds.Contains(o.Id) && o.State == ObjectiveLifecycleState.Approved, cancellationToken);
        var allApproved = childIds.Count > 0 && approvedChildCount == childIds.Count;

        try
        {
            objective.LockContributionBaseline(allApproved);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.Contribution", ex.Message));
        }
    }
}

public sealed class DeleteObjectiveHandler(PerformanceDbContext db)
    : ICommandHandler<DeleteObjectiveCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteObjectiveCommand command, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.Include(o => o.ContributionLinks).Include(o => o.Decisions)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId, cancellationToken);
        if (objective is null)
            return Result.Failure<bool>(Error.NotFound("Objective", command.ObjectiveId));
        if (objective.OwnershipScope != ObjectiveOwnershipScope.OrgUnit)
            return Result.Failure<bool>(Error.Conflict("Objective.NotOrganizational", "Only an organizational objective can be removed here."));
        if (!GoalsComposer.CanMaintain(objective, command.Actor))
            return Result.Failure<bool>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to remove this objective."));
        if (objective.State != ObjectiveLifecycleState.Draft)
            return Result.Failure<bool>(Error.Conflict("Objective.NotDraft", "Only a Draft objective can be removed."));

        var hasChildren = await db.Objectives.AnyAsync(o => o.ParentObjectiveId == objective.Id, cancellationToken);
        if (hasChildren)
            return Result.Failure<bool>(Error.Conflict("Objective.HasChildren", "Re-align or remove the aligned children first."));

        db.Objectives.Remove(objective);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(true);
    }
}
