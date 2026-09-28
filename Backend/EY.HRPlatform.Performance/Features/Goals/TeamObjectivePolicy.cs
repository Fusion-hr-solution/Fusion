using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Goals;

/// <summary>
/// Server-side scope and alignment policy for team-owned objectives. Client-provided unit,
/// owner, and parent ids are always resolved against the Cycle-start Core snapshot.
/// </summary>
public static class TeamObjectivePolicy
{
    public sealed record TeamScope(
        WorkforceOrgUnitContext Unit,
        IReadOnlyList<WorkforceSnapshot> ActiveMembers);

    private static DateTime AsOf(PerformanceCycle cycle)
        => cycle.StartDate.ToDateTime(TimeOnly.MinValue);

    public static async Task<Result<TeamScope>> ResolveScopeAsync(
        ICoreWorkforceClient workforce,
        PerformanceCycle cycle,
        GoalActorContext actor,
        Guid? requestedOrgUnitId,
        CancellationToken cancellationToken)
    {
        if (!actor.IsAdmin && !actor.HasOrgManageGrant)
            return Result.Failure<TeamScope>(Error.Forbidden(
                "Objective.TeamScopeForbidden",
                "You are not authorized to manage team objectives."));

        Guid orgUnitId;
        if (actor.IsAdmin)
        {
            if (requestedOrgUnitId is null || requestedOrgUnitId == Guid.Empty)
                return Result.Failure<TeamScope>(Error.Validation(
                    "Objective.TeamRequired",
                    "Choose the team that owns this objective."));
            orgUnitId = requestedOrgUnitId.Value;
        }
        else
        {
            if (actor.CallerEmployeeId == Guid.Empty)
                return Result.Failure<TeamScope>(Error.Forbidden(
                    "Objective.TeamScopeForbidden",
                    "A workforce-linked manager is required."));

            var caller = (await workforce.ResolveAsync(
                    AsOf(cycle),
                    [actor.CallerEmployeeId],
                    cancellationToken))
                .SingleOrDefault();
            if (caller is null || !caller.IsActive || caller.OrgUnit is null)
                return Result.Failure<TeamScope>(Error.Forbidden(
                    "Objective.TeamScopeForbidden",
                    "You did not have an active team assignment at the start of this Cycle."));

            orgUnitId = caller.OrgUnit.OrgUnitId;
            if (requestedOrgUnitId is not null && requestedOrgUnitId != orgUnitId)
                return Result.Failure<TeamScope>(Error.Forbidden(
                    "Objective.TeamScopeForbidden",
                    "Managers can manage objectives only for their own team."));
        }

        return await ResolveUnitAsync(workforce, cycle, orgUnitId, cancellationToken);
    }

    public static async Task<Result<TeamScope>> ResolveUnitAsync(
        ICoreWorkforceClient workforce,
        PerformanceCycle cycle,
        Guid orgUnitId,
        CancellationToken cancellationToken)
    {
        var unit = (await workforce.ResolveOrgUnitsAsync(
                AsOf(cycle),
                [orgUnitId],
                cancellationToken))
            .SingleOrDefault();
        if (unit is null || !unit.IsActive)
            return Result.Failure<TeamScope>(Error.Validation(
                "Objective.TeamInvalid",
                "The selected team was not active at the start of this Cycle."));

        var members = await workforce.GetByScopeAsync(
            AsOf(cycle),
            [orgUnitId],
            includeDescendants: false,
            cancellationToken);
        return Result.Success(new TeamScope(
            unit,
            members.Where(member => member.IsActive && member.OrgUnit?.OrgUnitId == orgUnitId).ToList()));
    }

    public static async Task<bool> CanGovernAsync(
        ICoreWorkforceClient workforce,
        PerformanceCycle cycle,
        GoalActorContext actor,
        Guid orgUnitId,
        CancellationToken cancellationToken)
        => (await ResolveScopeAsync(workforce, cycle, actor, orgUnitId, cancellationToken)).IsSuccess;

    public static Result ValidateOwner(TeamScope scope, Guid accountablePersonId)
        => scope.ActiveMembers.Any(member => member.EmployeeId == accountablePersonId)
            ? Result.Success()
            : Result.Failure(Error.Validation(
                "Objective.OwnerOutsideTeam",
                "Choose an active owner assigned to this team at the start of the Cycle."));

    public static async Task<IReadOnlyList<Objective>> EligibleParentsAsync(
        PerformanceDbContext db,
        PerformanceCycle cycle,
        TeamScope scope,
        CancellationToken cancellationToken)
    {
        var published = await db.Objectives
            .AsNoTracking()
            .Where(objective => objective.CycleId == cycle.Id
                && objective.State == ObjectiveLifecycleState.Published
                && objective.OwnershipScope != ObjectiveOwnershipScope.Employee)
            .ToListAsync(cancellationToken);
        var byId = published.ToDictionary(objective => objective.Id);
        var ancestorIds = scope.Unit.AncestorOrgUnitIds.ToHashSet();

        bool ConnectsToCompany(Objective objective)
        {
            var current = objective;
            var guard = new HashSet<Guid>();
            while (guard.Add(current.Id))
            {
                if (current.OwnershipScope == ObjectiveOwnershipScope.Company)
                    return true;
                if (current.ParentObjectiveId is not Guid parentId || !byId.TryGetValue(parentId, out current!))
                    return false;
            }
            return false;
        }

        var ancestorOrder = scope.Unit.AncestorOrgUnitIds
            .Select((id, index) => (id, index))
            .ToDictionary(item => item.id, item => item.index);

        return published
            .Where(objective => objective.OwnershipScope == ObjectiveOwnershipScope.Company
                || (objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
                    && objective.OrgUnitId is Guid unitId
                    && ancestorIds.Contains(unitId)
                    && ConnectsToCompany(objective)))
            .OrderBy(objective => objective.OwnershipScope == ObjectiveOwnershipScope.Company ? 1 : 0)
            .ThenByDescending(objective => objective.OrgUnitId is Guid unitId
                ? ancestorOrder.GetValueOrDefault(unitId, -1)
                : -1)
            .ThenBy(objective => objective.Title)
            .ToList();
    }

    public static async Task<Result<Objective?>> ResolveParentAsync(
        PerformanceDbContext db,
        PerformanceCycle cycle,
        TeamScope scope,
        Guid? parentObjectiveId,
        CancellationToken cancellationToken)
    {
        if (parentObjectiveId is null || parentObjectiveId == Guid.Empty)
            return Result.Success<Objective?>(null);

        var eligible = await EligibleParentsAsync(db, cycle, scope, cancellationToken);
        var parent = eligible.FirstOrDefault(objective => objective.Id == parentObjectiveId.Value);
        return parent is not null
            ? Result.Success<Objective?>(parent)
            : Result.Failure<Objective?>(Error.Validation(
                "Objective.AlignmentIneligible",
                "Choose a published objective from this team's upstream organization."));
    }
}
