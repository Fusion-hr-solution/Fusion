using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Goals;

/// <summary>
/// The caller's authorization inputs for organizational-goal actions, resolved once by the
/// controller from the token. <paramref name="IsAdmin"/> = governed Performance administration
/// (`cycle.manage @Tenant`); <paramref name="HasOrgManageGrant"/> = holds the organizational-
/// objective management capability (`objective.org.manage @Tenant`). Administrators may govern
/// any active team; managers are resolved to their own Cycle-start team by the server. This
/// authority is deliberately separate from a particular objective's accountable person.
/// </summary>
public sealed record GoalActorContext(Guid CallerEmployeeId, bool IsAdmin, bool HasOrgManageGrant);

public sealed record GetGoalsOverviewQuery(Guid CycleId, GoalActorContext Actor) : IQuery<Result<GoalsOverviewDto>>;
public sealed record GetGoalDetailQuery(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : IQuery<Result<GoalDetailDto>>;
public sealed record GetTeamObjectiveWorkspaceQuery(Guid CycleId, Guid? OrgUnitId, GoalActorContext Actor) : IQuery<Result<TeamObjectiveWorkspaceDto>>;
public sealed record CreateOrganizationalObjectiveCommand(Guid CycleId, CreateOrganizationalObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record UpdateOrganizationalObjectiveCommand(Guid CycleId, Guid ObjectiveId, UpdateOrganizationalObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record AlignObjectiveCommand(Guid CycleId, Guid ObjectiveId, AlignObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record PublishObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
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

        var canGovern = target.OrgUnitId is Guid unitId
            && await TeamObjectivePolicy.CanGovernAsync(workforce, cycle, request.Actor, unitId, cancellationToken);
        // Published team objectives are already offered to every plan author as alignment targets, so
        // their detail is readable too; a Draft stays with its team's governors and accountable person.
        if (target.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
            && target.State != ObjectiveLifecycleState.Published
            && !canGovern
            && target.AccountablePersonId != request.Actor.CallerEmployeeId)
            return Result.Failure<GoalDetailDto>(Error.Forbidden(
                "Objective.ViewForbidden",
                "You are not authorized to view this team's objective detail."));
        return GoalsComposer.BuildDetail(target, graph, request.Actor, canGovern);
    }
}

public sealed class GetTeamObjectiveWorkspaceHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetTeamObjectiveWorkspaceQuery, Result<TeamObjectiveWorkspaceDto>>
{
    public async Task<Result<TeamObjectiveWorkspaceDto>> Handle(GetTeamObjectiveWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<TeamObjectiveWorkspaceDto>(Error.NotFound("Cycle", request.CycleId));

        var scopeResult = await TeamObjectivePolicy.ResolveScopeAsync(workforce, cycle, request.Actor, request.OrgUnitId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<TeamObjectiveWorkspaceDto>(scopeResult.Error);
        var scope = scopeResult.Value;

        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        var eligible = await TeamObjectivePolicy.EligibleParentsAsync(db, cycle, scope, cancellationToken);
        var allTargets = PlansComposer.AlignmentTargets(graph);
        var targetsById = allTargets.ToDictionary(target => target.Id);
        // Keep the policy's nearest-team-first order rather than the alphabetical target order.
        var targets = eligible
            .Select(objective => targetsById.GetValueOrDefault(objective.Id))
            .OfType<AlignmentTargetDto>()
            .ToList();
        var objectives = graph.All
            .Where(objective => objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
                && objective.OrgUnitId == scope.Unit.OrgUnitId)
            .OrderBy(objective => objective.State == ObjectiveLifecycleState.Draft ? 0 : 1)
            .ThenBy(objective => objective.EndDate)
            .ThenBy(objective => objective.Title)
            .Select(objective => new TeamObjectiveWorkspaceItemDto(
                GoalsComposer.ToNode(objective, graph),
                objective.Description,
                objective.ParentObjectiveId is Guid parentId && targetsById.TryGetValue(parentId, out var parent)
                    ? parent
                    : null))
            .ToList();
        var owners = scope.ActiveMembers
            .OrderBy(member => member.DisplayName)
            .Select(member => new PersonRefDto(member.EmployeeId, member.DisplayName))
            .ToList();

        return Result.Success(new TeamObjectiveWorkspaceDto(
            scope.Unit.OrgUnitId,
            scope.Unit.Name,
            objectives,
            targets,
            owners,
            CanCreate: !cycle.IsClosed,
            CanChooseTeam: request.Actor.IsAdmin));
    }
}

// ── Command base (shared load + authorization + detail projection) ─────────────

public abstract class GoalCommandHandlerBase(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
{
    protected PerformanceDbContext Db => db;
    protected ICoreWorkforceClient Workforce => workforce;
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
            .FirstOrDefaultAsync(o => o.Id == objectiveId && o.CycleId == cycleId, cancellationToken);

    protected async Task<Result<GoalDetailDto>> ProjectAsync(PerformanceCycle cycle, Guid objectiveId, GoalActorContext actor, CancellationToken cancellationToken)
    {
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        var node = graph.ById.GetValueOrDefault(objectiveId);
        if (node is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", objectiveId));
        var canGovern = node.OrgUnitId is Guid unitId
            && await TeamObjectivePolicy.CanGovernAsync(workforce, cycle, actor, unitId, cancellationToken);
        return GoalsComposer.BuildDetail(node, graph, actor, canGovern);
    }

    protected async Task<bool> CanMaintainTeamObjectiveAsync(
        PerformanceCycle cycle,
        Objective objective,
        GoalActorContext actor,
        CancellationToken cancellationToken)
    {
        if (objective.OwnershipScope != ObjectiveOwnershipScope.OrgUnit || objective.OrgUnitId is not Guid orgUnitId)
            return false;

        return objective.AccountablePersonId == actor.CallerEmployeeId
            || await TeamObjectivePolicy.CanGovernAsync(workforce, cycle, actor, orgUnitId, cancellationToken);
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

        var scopeResult = await TeamObjectivePolicy.ResolveScopeAsync(
            Workforce, cycle, command.Actor, request.OrgUnitId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<GoalDetailDto>(scopeResult.Error);
        var scope = scopeResult.Value;
        var ownerResult = TeamObjectivePolicy.ValidateOwner(scope, request.AccountablePersonId);
        if (ownerResult.IsFailure)
            return Result.Failure<GoalDetailDto>(ownerResult.Error);
        var parentResult = await TeamObjectivePolicy.ResolveParentAsync(
            Db, cycle, scope, request.ParentObjectiveId, cancellationToken);
        if (parentResult.IsFailure)
            return Result.Failure<GoalDetailDto>(parentResult.Error);
        var parent = parentResult.Value;

        try
        {
            var measurement = request.ProgressSource == ObjectiveProgressSource.Direct && request.Measurement is not null
                ? PerformanceMappers.ToMeasurement(request.Measurement, Tenant.TenantId)
                : null;

            var objective = Objective.CreateOrganizational(
                Tenant.TenantId,
                cycle.Id,
                scope.Unit.OrgUnitId,
                scope.Unit.Name,
                request.Title,
                request.Description,
                request.AccountablePersonId,
                request.ParentObjectiveId,
                request.StartDate ?? parent?.StartDate ?? cycle.StartDate,
                request.EndDate ?? parent?.EndDate ?? cycle.EndDate,
                request.ProgressSource,
                measurement,
                parent?.StartDate,
                parent?.EndDate,
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
        if (objective.OrgUnitId is not Guid orgUnitId)
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotOrganizational", "Only a team objective can be maintained here."));
        var canGovern = await TeamObjectivePolicy.CanGovernAsync(Workforce, cycle, command.Actor, orgUnitId, cancellationToken);
        if (!canGovern && objective.AccountablePersonId != command.Actor.CallerEmployeeId)
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        var request = command.Request;
        var scopeResult = await TeamObjectivePolicy.ResolveUnitAsync(Workforce, cycle, orgUnitId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<GoalDetailDto>(scopeResult.Error);
        var scope = scopeResult.Value;
        var ownerResult = TeamObjectivePolicy.ValidateOwner(scope, request.AccountablePersonId);
        if (ownerResult.IsFailure)
            return Result.Failure<GoalDetailDto>(ownerResult.Error);
        var parentResult = await TeamObjectivePolicy.ResolveParentAsync(
            Db, cycle, scope, request.ParentObjectiveId, cancellationToken);
        if (parentResult.IsFailure)
            return Result.Failure<GoalDetailDto>(parentResult.Error);
        var parent = parentResult.Value;
        try
        {
            var measurement = request.ProgressSource == ObjectiveProgressSource.Direct && request.Measurement is not null
                ? PerformanceMappers.ToMeasurement(request.Measurement, Tenant.TenantId)
                : null;

            objective.UpdateOrganizationalDetails(
                request.Title,
                request.Description,
                request.AccountablePersonId,
                request.ParentObjectiveId,
                request.StartDate,
                request.EndDate,
                request.ProgressSource,
                measurement,
                parent?.StartDate,
                parent?.EndDate,
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
        if (objective.OrgUnitId is not Guid orgUnitId)
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotOrganizational", "Only a team objective can be aligned here."));
        var canGovern = await TeamObjectivePolicy.CanGovernAsync(Workforce, cycle, command.Actor, orgUnitId, cancellationToken);
        if (!canGovern && objective.AccountablePersonId != command.Actor.CallerEmployeeId)
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        var newParentId = command.Request.ParentObjectiveId;
        var scopeResult = await TeamObjectivePolicy.ResolveUnitAsync(Workforce, cycle, orgUnitId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<GoalDetailDto>(scopeResult.Error);
        var parentResult = await TeamObjectivePolicy.ResolveParentAsync(
            Db, cycle, scopeResult.Value, newParentId, cancellationToken);
        if (parentResult.IsFailure)
            return Result.Failure<GoalDetailDto>(parentResult.Error);
        var newParent = parentResult.Value;

        // Reject a cycle: the new parent must not be the objective itself or one of its descendants.
        var wouldCycle = newParentId is not null
            && await GoalsComposer.CreatesCycleAsync(Db, cycle.Id, objective.Id, newParentId.Value, cancellationToken);
        if (wouldCycle)
            return Result.Failure<GoalDetailDto>(Error.Validation("Objective.Alignment", "That alignment would create a circular hierarchy."));

        try
        {
            objective.AlignTo(newParentId, newParent?.StartDate, newParent?.EndDate);
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

// ── Lifecycle: publish ───────────────────────────────────────────────────────

public sealed class PublishObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<PublishObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(PublishObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(Error.NotFound("Objective", command.ObjectiveId));
        // Publishing establishes official organizational direction, so it requires organizational
        // management authority (governed admin, or the org-manage grant) — NOT merely being the
        // objective's accountable person. This keeps a scope manager able to publish a Draft even
        // after assigning someone else as its accountable person.
        if (objective.OrgUnitId is not Guid orgUnitId
            || !await TeamObjectivePolicy.CanGovernAsync(Workforce, cycle, command.Actor, orgUnitId, cancellationToken))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.PublishForbidden", "You are not authorized to publish organizational objectives."));

        try
        {
            objective.Publish();
            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.NotPublishable", ex.Message));
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
        if (!await CanMaintainTeamObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
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
        if (!await CanMaintainTeamObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<GoalDetailDto>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to maintain this objective."));

        var childIds = objective.ContributionLinks.Select(l => l.ChildObjectiveId).ToList();
        var publishedChildCount = await Db.Objectives.AsNoTracking()
            .CountAsync(o => childIds.Contains(o.Id) && o.State == ObjectiveLifecycleState.Published, cancellationToken);
        var allPublished = childIds.Count > 0 && publishedChildCount == childIds.Count;

        try
        {
            objective.LockContributionBaseline(allPublished);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(Error.Conflict("Objective.Contribution", ex.Message));
        }
    }
}

public sealed class DeleteObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : GoalCommandHandlerBase(db, workforce, tenant), ICommandHandler<DeleteObjectiveCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<bool>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<bool>(Error.NotFound("Objective", command.ObjectiveId));
        if (objective.OwnershipScope != ObjectiveOwnershipScope.OrgUnit)
            return Result.Failure<bool>(Error.Conflict("Objective.NotOrganizational", "Only an organizational objective can be removed here."));
        if (!await CanMaintainTeamObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<bool>(Error.Forbidden("Objective.MaintainForbidden", "You are not authorized to remove this objective."));
        if (objective.State != ObjectiveLifecycleState.Draft)
            return Result.Failure<bool>(Error.Conflict("Objective.NotDraft", "Only a Draft objective can be removed."));

        var hasChildren = await Db.Objectives.AnyAsync(o => o.ParentObjectiveId == objective.Id, cancellationToken);
        if (hasChildren)
            return Result.Failure<bool>(Error.Conflict("Objective.HasChildren", "Re-align or remove the aligned children first."));

        Db.Objectives.Remove(objective);
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(true);
    }
}
