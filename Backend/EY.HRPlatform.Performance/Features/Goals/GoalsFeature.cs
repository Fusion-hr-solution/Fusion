using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
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
/// <paramref name="CanReviewReports"/> (view @DirectReports or wider) and <paramref name="CanPublishStrategy"/>
/// complete the inputs <see cref="ObjectivePolicy"/> needs to decide visibility across every scope.
public sealed record GoalActorContext(
    Guid CallerEmployeeId,
    bool IsAdmin,
    bool HasOrgManageGrant,
    bool CanReviewReports = false,
    bool CanPublishStrategy = false);

public sealed record GetGoalsOverviewQuery(Guid CycleId, GoalActorContext Actor) : IQuery<Result<GoalsOverviewDto>>;
public sealed record GetGoalDetailQuery(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor) : IQuery<Result<GoalDetailDto>>;
public sealed record GetTeamObjectiveWorkspaceQuery(Guid CycleId, Guid? OrgUnitId, GoalActorContext Actor) : IQuery<Result<TeamObjectiveWorkspaceDto>>;
public sealed record CreateOrganizationalObjectiveCommand(Guid CycleId, CreateOrganizationalObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record UpdateOrganizationalObjectiveCommand(Guid CycleId, Guid ObjectiveId, UpdateOrganizationalObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record AlignObjectiveCommand(Guid CycleId, Guid ObjectiveId, AlignObjectiveRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record PublishObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor, uint ExpectedVersion = 0) : ICommand<Result<GoalDetailDto>>;
public sealed record ArchiveObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor, uint ExpectedVersion = 0) : ICommand<Result<GoalDetailDto>>;
public sealed record ConfigureContributionCommand(Guid CycleId, Guid ObjectiveId, ConfigureContributionRequest Request, GoalActorContext Actor) : ICommand<Result<GoalDetailDto>>;
public sealed record LockContributionCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor, uint ExpectedVersion = 0) : ICommand<Result<GoalDetailDto>>;
public sealed record DeleteObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor, uint ExpectedVersion = 0) : ICommand<Result<bool>>;

// ── Queries ──────────────────────────────────────────────────────────────────

public sealed class GetGoalsOverviewHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer? caller = null)
    : IQueryHandler<GetGoalsOverviewQuery, Result<GoalsOverviewDto>>
{
    public async Task<Result<GoalsOverviewDto>> Handle(GetGoalsOverviewQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<GoalsOverviewDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));

        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, request.Actor, cancellationToken);
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken, viewer);
        return GoalsComposer.BuildOverview(cycle, graph, viewer);
    }
}

public sealed class GetGoalDetailHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer? caller = null)
    : IQueryHandler<GetGoalDetailQuery, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(GetGoalDetailQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));

        var target = await db.Objectives.AsNoTracking().Include(o => o.Measurement).Include(o => o.ContributionLinks)
            .FirstOrDefaultAsync(o => o.CycleId == cycle.Id && o.Id == request.ObjectiveId, cancellationToken);
        if (target is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", request.ObjectiveId));

        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, request.Actor, cancellationToken);
        var plan = await GoalsComposer.LoadOwningPlanAsync(db, target, cancellationToken);
        if (!ObjectivePolicy.CanRead(viewer, target, plan))
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(
                PerformanceErrors.Codes.ObjectiveViewForbidden,
                "You are not authorized to view this objective."));
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken, viewer);
        return GoalsComposer.BuildDetail(cycle, target, graph, viewer, plan);
    }
}

public sealed class GetTeamObjectiveWorkspaceHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer? caller = null)
    : IQueryHandler<GetTeamObjectiveWorkspaceQuery, Result<TeamObjectiveWorkspaceDto>>
{
    public async Task<Result<TeamObjectiveWorkspaceDto>> Handle(GetTeamObjectiveWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<TeamObjectiveWorkspaceDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));

        var scopeResult = await TeamObjectivePolicy.ResolveScopeAsync(workforce, cycle, request.Actor, request.OrgUnitId, cancellationToken);
        if (scopeResult.IsFailure)
            return Result.Failure<TeamObjectiveWorkspaceDto>(scopeResult.Error);
        var scope = scopeResult.Value;

        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, request.Actor, cancellationToken);
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken, viewer);
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

public abstract class GoalCommandHandlerBase(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, PerformanceViewer? caller = null)
{
    protected PerformanceDbContext Db => db;
    protected ICoreWorkforceClient Workforce => workforce;
    protected ITenantContext Tenant => tenant;

    protected async Task<Result<PerformanceCycle>> LoadOpenCycleAsync(Guid cycleId, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == cycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PerformanceCycle>(PerformanceErrors.NotFound("Cycle", cycleId));
        if (cycle.IsClosed)
            return Result.Failure<PerformanceCycle>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only; objective planning is not available."));
        return Result.Success(cycle);
    }

    protected Task<Objective?> LoadTrackedAsync(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
        => db.Objectives
            .Include(o => o.ContributionLinks)
            .FirstOrDefaultAsync(o => o.Id == objectiveId && o.CycleId == cycleId, cancellationToken);

    protected async Task<Result<GoalDetailDto>> ProjectAsync(PerformanceCycle cycle, Guid objectiveId, GoalActorContext actor, CancellationToken cancellationToken)
    {
        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, actor, cancellationToken);
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken, viewer);
        var node = graph.ById.GetValueOrDefault(objectiveId);
        if (node is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", objectiveId));
        var plan = await GoalsComposer.LoadOwningPlanAsync(db, node, cancellationToken);
        return GoalsComposer.BuildDetail(cycle, node, graph, viewer, plan);
    }

    protected async Task<bool> CanGovernObjectiveAsync(PerformanceCycle cycle, Objective objective, GoalActorContext actor, CancellationToken cancellationToken)
    {
        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, actor, cancellationToken);
        return ObjectivePolicy.CanGovern(viewer, objective);
    }

    protected async Task<bool> CanMaintainTeamObjectiveAsync(
        PerformanceCycle cycle,
        Objective objective,
        GoalActorContext actor,
        CancellationToken cancellationToken)
    {
        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, actor, cancellationToken);
        return ObjectivePolicy.CanMaintain(viewer, objective);
    }
}

// ── Create ─────────────────────────────────────────────────────────────────

public sealed class CreateOrganizationalObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<CreateOrganizationalObjectiveCommand, Result<GoalDetailDto>>
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

        if (VersionGuard.Check(cycle, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

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

            if (cycle.IsDraft) cycle.Touch();
            Db.Objectives.Add(objective);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ObjectiveInvalid, ex.Message));
        }
    }
}

// ── Update / Align ─────────────────────────────────────────────────────────

public sealed class UpdateOrganizationalObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, IPerformanceAudit audit, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<UpdateOrganizationalObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(UpdateOrganizationalObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        if (objective.OrgUnitId is not Guid orgUnitId)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotOrganizational, "Only a team objective can be maintained here."));
        var canGovern = await CanGovernObjectiveAsync(cycle, objective, command.Actor, cancellationToken);
        if (!canGovern && objective.AccountablePersonId != command.Actor.CallerEmployeeId)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveMaintainForbidden, "You are not authorized to maintain this objective."));

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
        if (VersionGuard.Check(objective, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

        var before = objective.ParentObjectiveId;
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
            if (before != objective.ParentObjectiveId)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectiveRealigned,
                    new { before, after = objective.ParentObjectiveId });
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ObjectiveInvalid, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotEditable, ex.Message));
        }
    }
}

public sealed class AlignObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, IPerformanceAudit audit, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<AlignObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(AlignObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        if (objective.OrgUnitId is not Guid orgUnitId)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotOrganizational, "Only a team objective can be aligned here."));
        var canGovern = await CanGovernObjectiveAsync(cycle, objective, command.Actor, cancellationToken);
        if (!canGovern && objective.AccountablePersonId != command.Actor.CallerEmployeeId)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveMaintainForbidden, "You are not authorized to maintain this objective."));

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
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ObjectiveAlignment, "That alignment would create a circular hierarchy."));

        if (VersionGuard.Check(objective, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

        try
        {
            var before = objective.ParentObjectiveId;
            objective.AlignTo(newParentId, newParent?.StartDate, newParent?.EndDate);
            if (before != objective.ParentObjectiveId)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectiveRealigned,
                    new { before, after = objective.ParentObjectiveId });
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ObjectiveInvalid, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotEditable, ex.Message));
        }
    }
}

// ── Lifecycle: publish ───────────────────────────────────────────────────────

public sealed class PublishObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, IPerformanceAudit audit, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<PublishObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(PublishObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        // Publishing establishes official organizational direction, so it requires organizational
        // management authority (governed admin, or the org-manage grant) — NOT merely being the
        // objective's accountable person. This keeps a scope manager able to publish a Draft even
        // after assigning someone else as its accountable person.
        if (objective.OrgUnitId is not Guid orgUnitId
            || !await CanGovernObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectivePublishForbidden, "You are not authorized to publish organizational objectives."));

        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

        try
        {
            var before = objective.State;
            objective.Publish();
            GoalsComposer.FixNewChildRowState(Db);
            if (before != objective.State)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectivePublished,
                    new { before = before.ToString(), after = objective.State.ToString() });
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotPublishable, ex.Message));
        }
    }
}

// ── Contribution baseline ────────────────────────────────────────────────────

public sealed class ConfigureContributionHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<ConfigureContributionCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(ConfigureContributionCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        if (!await CanMaintainTeamObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveMaintainForbidden, "You are not authorized to maintain this objective."));

        // A contributor must be an aligned child of this objective (alignment ≠ contribution, but a
        // contributor is necessarily aligned).
        var alignedChildIds = await Db.Objectives.AsNoTracking()
            .Where(o => o.ParentObjectiveId == objective.Id)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);

        var invalid = command.Request.Contributors.Select(c => c.ChildObjectiveId).Except(alignedChildIds).ToList();
        if (invalid.Count > 0)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ObjectiveContribution, "Only aligned children can be configured as contributors."));

        if (VersionGuard.Check(objective, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

        try
        {
            objective.ConfigureContribution(command.Request.Contributors.Select(c => (c.ChildObjectiveId, c.Weight)));
            GoalsComposer.FixNewChildRowState(Db);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ObjectiveContribution, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveContribution, ex.Message));
        }
    }
}

public sealed class LockContributionHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, IPerformanceAudit audit, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<LockContributionCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(LockContributionCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        if (!await CanMaintainTeamObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveMaintainForbidden, "You are not authorized to maintain this objective."));

        var childIds = objective.ContributionLinks.Select(l => l.ChildObjectiveId).ToList();
        var publishedChildCount = await Db.Objectives.AsNoTracking()
            .CountAsync(o => childIds.Contains(o.Id) && o.State == ObjectiveLifecycleState.Published, cancellationToken);
        var allPublished = childIds.Count > 0 && publishedChildCount == childIds.Count;

        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale)
            return Result.Failure<GoalDetailDto>(stale);

        try
        {
            var wasLocked = objective.IsContributionBaselineLocked;
            objective.LockContributionBaseline(allPublished);
            if (!wasLocked) audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ContributionLocked,
                new { before = "Unlocked", after = "Locked", objective.ContributionBaselineLockedAt, contributors = objective.ContributionLinks.Select(l => new { l.ChildObjectiveId, l.Weight }) });
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveContribution, ex.Message));
        }
    }
}

public sealed class DeleteObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<DeleteObjectiveCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<bool>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<bool>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        if (objective.OwnershipScope != ObjectiveOwnershipScope.OrgUnit)
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotOrganizational, "Only an organizational objective can be removed here."));
        if (!await CanMaintainTeamObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<bool>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveMaintainForbidden, "You are not authorized to remove this objective."));
        if (objective.State != ObjectiveLifecycleState.Draft)
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotDraft, "Only a Draft objective can be removed."));

        var hasChildren = await Db.Objectives.AnyAsync(o => o.ParentObjectiveId == objective.Id, cancellationToken);
        if (hasChildren)
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveHasChildren, "Re-align or remove the aligned children first."));

        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale)
            return Result.Failure<bool>(stale);

        Db.Objectives.Remove(objective);
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(true);
    }
}

public sealed class ArchiveObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, IPerformanceAudit audit, PerformanceViewer? caller = null)
    : GoalCommandHandlerBase(db, workforce, tenant, caller), ICommandHandler<ArchiveObjectiveCommand, Result<GoalDetailDto>>
{
    public async Task<Result<GoalDetailDto>> Handle(ArchiveObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<GoalDetailDto>(cycleResult.Error);
        var cycle = cycleResult.Value;
        var objective = await LoadTrackedAsync(cycle.Id, command.ObjectiveId, cancellationToken);
        if (objective is null) return Result.Failure<GoalDetailDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        if (objective.OwnershipScope != ObjectiveOwnershipScope.OrgUnit)
            return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotOrganizational, "Only an organizational objective can be archived here."));
        if (!await CanGovernObjectiveAsync(cycle, objective, command.Actor, cancellationToken))
            return Result.Failure<GoalDetailDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveArchiveForbidden, "You are not authorized to archive this objective."));
        if (objective.State == ObjectiveLifecycleState.Archived) return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale) return Result.Failure<GoalDetailDto>(stale);
        try
        {
            objective.Archive();
            if (cycle.IsDraft) cycle.Touch();
            audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectiveArchived,
                new { before = "Published", after = "Archived", objective.ArchivedAt });
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, objective.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex) { return Result.Failure<GoalDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotArchivable, ex.Message)); }
    }
}
