using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Plans;

// ── Queries ────────────────────────────────────────────────────────────────────

public sealed record GetMyPlanQuery(Guid CycleId, PlanActorContext Actor) : IQuery<Result<MyPlanStateDto>>;
public sealed record GetAlignmentTargetsQuery(Guid CycleId, PlanActorContext Actor) : IQuery<Result<IReadOnlyList<AlignmentTargetDto>>>;
public sealed record GetPlanReviewsQuery(Guid CycleId, PlanActorContext Actor) : IQuery<Result<PlanReviewListDto>>;
public sealed record GetPlanForReviewQuery(Guid CycleId, Guid PlanId, PlanActorContext Actor) : IQuery<Result<EmployeePlanDto>>;

// ── Commands ───────────────────────────────────────────────────────────────────

public sealed record CreateMyPlanCommand(Guid CycleId, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record AddPlanObjectiveCommand(Guid CycleId, AddPlanObjectiveRequest Request, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record UpdatePlanObjectiveCommand(Guid CycleId, Guid ObjectiveId, UpdatePlanObjectiveRequest Request, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record RemovePlanObjectiveCommand(Guid CycleId, Guid ObjectiveId, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record SetPlanWeightsCommand(Guid CycleId, SetPlanWeightsRequest Request, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record SubmitMyPlanCommand(Guid CycleId, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record ReturnPlanCommand(Guid CycleId, Guid PlanId, ReturnPlanRequest Request, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record ApprovePlanCommand(Guid CycleId, Guid PlanId, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;
public sealed record ExceptionalApprovePlanCommand(Guid CycleId, Guid PlanId, ExceptionalApprovePlanRequest Request, PlanActorContext Actor) : ICommand<Result<EmployeePlanDto>>;

// ── Shared base ────────────────────────────────────────────────────────────────

public abstract class PlanHandlerBase(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
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
            return Result.Failure<PerformanceCycle>(Error.Conflict("Cycle.Closed", "A Closed Cycle is read-only; plan authoring is not available."));
        return Result.Success(cycle);
    }

    protected async Task<bool> StandaloneAllowedAsync(CancellationToken cancellationToken)
    {
        var settings = await db.CycleSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        return settings?.AllowStandaloneObjectives ?? true;
    }

    protected Task<EmployeePlan?> LoadPlanTrackedAsync(Guid cycleId, Guid planId, CancellationToken cancellationToken)
        => db.EmployeePlans.Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == planId && p.CycleId == cycleId, cancellationToken);

    protected Task<EmployeePlan?> LoadMyPlanTrackedAsync(Guid cycleId, Guid employeeId, CancellationToken cancellationToken)
        => db.EmployeePlans.Include(p => p.Decisions).FirstOrDefaultAsync(p => p.CycleId == cycleId && p.EmployeeId == employeeId, cancellationToken);

    protected async Task<Result<EmployeePlanDto>> ProjectAsync(PerformanceCycle cycle, Guid planId, PlanActorContext actor, CancellationToken cancellationToken)
    {
        var plan = await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == planId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", planId));
        var standaloneAllowed = await StandaloneAllowedAsync(cancellationToken);
        var dto = await PlansComposer.BuildPlanAsync(db, workforce, cycle, plan, standaloneAllowed, actor, cancellationToken);
        return Result.Success(dto);
    }

    /// <summary>A new plan-decision row reached through an already-tracked plan is detected Modified; correct it to Added.</summary>
    protected void FixNewPlanRows()
    {
        foreach (var entry in Db.ChangeTracker.Entries().Where(e => e.State == EntityState.Modified))
        {
            if (entry.Entity is PlanDecision)
                entry.State = EntityState.Added;
        }
    }
}

// ── Query handlers ───────────────────────────────────────────────────────────────

public sealed class GetMyPlanHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), IQueryHandler<GetMyPlanQuery, Result<MyPlanStateDto>>
{
    public async Task<Result<MyPlanStateDto>> Handle(GetMyPlanQuery request, CancellationToken cancellationToken)
    {
        var cycle = await Db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<MyPlanStateDto>(Error.NotFound("Cycle", request.CycleId));

        var employeeId = request.Actor.CallerEmployeeId;
        var participates = await Db.Participants.AsNoTracking().AnyAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, cancellationToken);
        if (!participates)
            return Result.Success(new MyPlanStateDto(false, false, null));

        var plan = await Db.EmployeePlans.AsNoTracking().Include(p => p.Decisions)
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, cancellationToken);
        if (plan is null)
            return Result.Success(new MyPlanStateDto(true, false, null));

        var standaloneAllowed = await StandaloneAllowedAsync(cancellationToken);
        var dto = await PlansComposer.BuildPlanAsync(Db, Workforce, cycle, plan, standaloneAllowed, request.Actor, cancellationToken);
        return Result.Success(new MyPlanStateDto(true, true, dto));
    }
}

public sealed class GetAlignmentTargetsHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), IQueryHandler<GetAlignmentTargetsQuery, Result<IReadOnlyList<AlignmentTargetDto>>>
{
    public async Task<Result<IReadOnlyList<AlignmentTargetDto>>> Handle(GetAlignmentTargetsQuery request, CancellationToken cancellationToken)
    {
        var cycle = await Db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<IReadOnlyList<AlignmentTargetDto>>(Error.NotFound("Cycle", request.CycleId));

        var graph = await GoalsComposer.LoadGraphAsync(Db, Workforce, cycle, cancellationToken);
        return Result.Success(PlansComposer.AlignmentTargets(graph));
    }
}

public sealed class GetPlanReviewsHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), IQueryHandler<GetPlanReviewsQuery, Result<PlanReviewListDto>>
{
    public async Task<Result<PlanReviewListDto>> Handle(GetPlanReviewsQuery request, CancellationToken cancellationToken)
    {
        var cycle = await Db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<PlanReviewListDto>(Error.NotFound("Cycle", request.CycleId));

        // The manager sees plans they are responsible for; an administrator sees the whole submitted queue.
        var query = Db.EmployeePlans.AsNoTracking().Where(p => p.CycleId == cycle.Id && p.State == PlanLifecycleState.Submitted);
        if (!request.Actor.IsAdmin)
            query = query.Where(p => p.ResponsibleManagerId == request.Actor.CallerEmployeeId);

        var plans = await query.ToListAsync(cancellationToken);
        var graph = await GoalsComposer.LoadGraphAsync(Db, Workforce, cycle, cancellationToken);
        var summaries = plans
            .Select(p => PlansComposer.ToReviewSummary(p, graph))
            .OrderBy(s => s.SubmittedAt)
            .ToList();

        return Result.Success(new PlanReviewListDto(cycle.Id, cycle.Name, summaries.Count, summaries));
    }
}

public sealed class GetPlanForReviewHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), IQueryHandler<GetPlanForReviewQuery, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(GetPlanForReviewQuery request, CancellationToken cancellationToken)
    {
        var cycle = await Db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Cycle", request.CycleId));

        var plan = await Db.EmployeePlans.AsNoTracking().Include(p => p.Decisions)
            .FirstOrDefaultAsync(p => p.Id == request.PlanId && p.CycleId == cycle.Id, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", request.PlanId));

        // Only the responsible manager, an administrator, or the plan's own employee may open the plan detail.
        var isParticipantOrManager = plan.EmployeeId == request.Actor.CallerEmployeeId
            || request.Actor.IsAdmin
            || PlansComposer.CanDecide(plan, request.Actor);
        if (!isParticipantOrManager)
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.ViewForbidden", "You are not authorized to view this plan."));

        var standaloneAllowed = await StandaloneAllowedAsync(cancellationToken);
        var dto = await PlansComposer.BuildPlanAsync(Db, Workforce, cycle, plan, standaloneAllowed, request.Actor, cancellationToken);
        return Result.Success(dto);
    }
}

// ── Command handlers ─────────────────────────────────────────────────────────────

public sealed class CreateMyPlanHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<CreateMyPlanCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(CreateMyPlanCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;
        var employeeId = command.Actor.CallerEmployeeId;

        var existing = await LoadMyPlanTrackedAsync(cycle.Id, employeeId, cancellationToken);
        if (existing is not null)
            return await ProjectAsync(cycle, existing.Id, command.Actor, cancellationToken);

        var participant = await Db.Participants.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CycleId == cycle.Id && p.EmployeeId == employeeId, cancellationToken);
        if (participant is null)
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.NotParticipant", "You are not a participant in this Cycle."));

        try
        {
            var plan = EmployeePlan.Create(
                Tenant.TenantId,
                cycle.Id,
                participant.Id,
                participant.EmployeeId,
                participant.DisplayName,
                participant.OrgUnitName,
                participant.ManagerEmployeeId,
                participant.ManagerDisplayName);

            Db.EmployeePlans.Add(plan);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (DbUpdateException)
        {
            // A concurrent create raced us; return the winning plan (one-plan-per-participant invariant).
            var winner = await LoadMyPlanTrackedAsync(cycle.Id, employeeId, cancellationToken);
            if (winner is not null) return await ProjectAsync(cycle, winner.Id, command.Actor, cancellationToken);
            return Result.Failure<EmployeePlanDto>(Error.Conflict("Plan.Conflict", "A plan already exists for this participant."));
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Invalid", ex.Message));
        }
    }
}

public sealed class AddPlanObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<AddPlanObjectiveCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(AddPlanObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadMyPlanTrackedAsync(cycle.Id, command.Actor.CallerEmployeeId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.Actor.CallerEmployeeId));
        if (!PlansComposer.CanAuthor(plan, command.Actor))
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.AuthorForbidden", "Only you can author your own plan while it is Draft."));

        var request = command.Request;
        var parentResult = await ResolveAlignmentAsync(cycle, request.ParentObjectiveId, cancellationToken);
        if (parentResult.IsFailure) return Result.Failure<EmployeePlanDto>(parentResult.Error);
        var parent = parentResult.Value;

        try
        {
            var measurement = PerformanceMappers.ToMeasurement(request.Measurement, Tenant.TenantId);
            var objective = Objective.CreateEmployee(
                Tenant.TenantId,
                cycle.Id,
                plan.Id,
                command.Actor.CallerEmployeeId,
                request.Title,
                request.Description,
                request.ParentObjectiveId,
                request.StartDate ?? parent?.StartDate ?? cycle.StartDate,
                request.EndDate ?? parent?.EndDate ?? cycle.EndDate,
                measurement,
                request.PlanWeight,
                parent?.StartDate,
                parent?.EndDate,
                cycle.StartDate,
                cycle.EndDate);

            Db.Objectives.Add(objective);
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Objective.Invalid", ex.Message));
        }
    }

    private async Task<Result<Objective?>> ResolveAlignmentAsync(PerformanceCycle cycle, Guid? parentObjectiveId, CancellationToken cancellationToken)
    {
        if (parentObjectiveId is null) return Result.Success<Objective?>(null);
        var parent = await Db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == parentObjectiveId.Value, cancellationToken);
        if (parent is null) return Result.Failure<Objective?>(Error.NotFound("ParentObjective", parentObjectiveId.Value));
        if (parent.CycleId != cycle.Id)
            return Result.Failure<Objective?>(Error.Validation("Plan.Alignment", "The aligned objective belongs to a different Cycle."));
        if (!parent.IsAlignmentBaseline)
            return Result.Failure<Objective?>(Error.Conflict("Plan.ParentNotBaseline", "You can only align to a published objective."));
        if (parent.OwnershipScope == ObjectiveOwnershipScope.Employee)
            return Result.Failure<Objective?>(Error.Validation("Plan.Alignment", "An employee objective aligns to strategic or organizational direction, not another plan objective."));
        return Result.Success<Objective?>(parent);
    }
}

public sealed class UpdatePlanObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<UpdatePlanObjectiveCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(UpdatePlanObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadMyPlanTrackedAsync(cycle.Id, command.Actor.CallerEmployeeId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.Actor.CallerEmployeeId));
        if (!PlansComposer.CanAuthor(plan, command.Actor))
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.AuthorForbidden", "Only you can author your own plan while it is Draft."));

        var objective = await Db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.EmployeePlanId == plan.Id, cancellationToken);
        if (objective is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Objective", command.ObjectiveId));

        var request = command.Request;
        var parentResult = await ResolveAlignmentAsync(cycle, request.ParentObjectiveId, cancellationToken);
        if (parentResult.IsFailure) return Result.Failure<EmployeePlanDto>(parentResult.Error);
        var parent = parentResult.Value;

        try
        {
            var measurement = PerformanceMappers.ToMeasurement(request.Measurement, Tenant.TenantId);
            objective.UpdateEmployeeDetails(
                request.Title,
                request.Description,
                request.ParentObjectiveId,
                request.StartDate ?? parent?.StartDate ?? cycle.StartDate,
                request.EndDate ?? parent?.EndDate ?? cycle.EndDate,
                measurement,
                request.PlanWeight,
                parent?.StartDate,
                parent?.EndDate,
                cycle.StartDate,
                cycle.EndDate);

            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Objective.Invalid", ex.Message));
        }
    }

    private async Task<Result<Objective?>> ResolveAlignmentAsync(PerformanceCycle cycle, Guid? parentObjectiveId, CancellationToken cancellationToken)
    {
        if (parentObjectiveId is null) return Result.Success<Objective?>(null);
        var parent = await Db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == parentObjectiveId.Value, cancellationToken);
        if (parent is null) return Result.Failure<Objective?>(Error.NotFound("ParentObjective", parentObjectiveId.Value));
        if (parent.CycleId != cycle.Id)
            return Result.Failure<Objective?>(Error.Validation("Plan.Alignment", "The aligned objective belongs to a different Cycle."));
        if (!parent.IsAlignmentBaseline)
            return Result.Failure<Objective?>(Error.Conflict("Plan.ParentNotBaseline", "You can only align to a published objective."));
        if (parent.OwnershipScope == ObjectiveOwnershipScope.Employee)
            return Result.Failure<Objective?>(Error.Validation("Plan.Alignment", "An employee objective aligns to strategic or organizational direction, not another plan objective."));
        return Result.Success<Objective?>(parent);
    }
}

public sealed class RemovePlanObjectiveHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<RemovePlanObjectiveCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(RemovePlanObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadMyPlanTrackedAsync(cycle.Id, command.Actor.CallerEmployeeId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.Actor.CallerEmployeeId));
        if (!PlansComposer.CanAuthor(plan, command.Actor))
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.AuthorForbidden", "Only you can author your own plan while it is Draft."));

        var objective = await Db.Objectives.FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.EmployeePlanId == plan.Id, cancellationToken);
        if (objective is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Objective", command.ObjectiveId));

        Db.Objectives.Remove(objective);
        await Db.SaveChangesAsync(cancellationToken);
        return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
    }
}

public sealed class SetPlanWeightsHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<SetPlanWeightsCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(SetPlanWeightsCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadMyPlanTrackedAsync(cycle.Id, command.Actor.CallerEmployeeId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.Actor.CallerEmployeeId));
        if (!PlansComposer.CanAuthor(plan, command.Actor))
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.AuthorForbidden", "Only you can author your own plan while it is Draft."));

        var objectives = await Db.Objectives.Where(o => o.EmployeePlanId == plan.Id).ToListAsync(cancellationToken);
        var byId = objectives.ToDictionary(o => o.Id);

        try
        {
            foreach (var weight in command.Request.Weights)
            {
                if (!byId.TryGetValue(weight.ObjectiveId, out var objective))
                    return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Weight", "A weight was given for an objective not in your plan."));
                objective.SetPlanWeight(weight.Weight);
            }

            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Weight", ex.Message));
        }
    }
}

public sealed class SubmitMyPlanHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<SubmitMyPlanCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(SubmitMyPlanCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadMyPlanTrackedAsync(cycle.Id, command.Actor.CallerEmployeeId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.Actor.CallerEmployeeId));

        var standaloneAllowed = await StandaloneAllowedAsync(cancellationToken);
        var graph = await GoalsComposer.LoadGraphAsync(Db, Workforce, cycle, cancellationToken);
        var facts = PlansComposer.FactsFor(plan, graph, standaloneAllowed);

        try
        {
            plan.Submit(command.Actor.CallerEmployeeId, facts);
            FixNewPlanRows();
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Conflict("Plan.NotSubmittable", ex.Message));
        }
    }
}

public sealed class ReturnPlanHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<ReturnPlanCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(ReturnPlanCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadPlanTrackedAsync(cycle.Id, command.PlanId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.PlanId));
        if (!PlansComposer.CanDecide(plan, command.Actor))
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.DecideForbidden", "Only the responsible manager can return this plan."));

        try
        {
            plan.Return(command.Actor.CallerEmployeeId, command.Request.Feedback);
            FixNewPlanRows();
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Feedback", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Conflict("Plan.NotReturnable", ex.Message));
        }
    }
}

public sealed class ApprovePlanHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<ApprovePlanCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(ApprovePlanCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        var plan = await LoadPlanTrackedAsync(cycle.Id, command.PlanId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.PlanId));
        if (!PlansComposer.CanDecide(plan, command.Actor))
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.DecideForbidden", "Only the responsible manager can approve this plan."));

        try
        {
            plan.Approve(command.Actor.CallerEmployeeId);
            FixNewPlanRows();
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Conflict("Plan.NotApprovable", ex.Message));
        }
    }
}

public sealed class ExceptionalApprovePlanHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : PlanHandlerBase(db, workforce, tenant), ICommandHandler<ExceptionalApprovePlanCommand, Result<EmployeePlanDto>>
{
    public async Task<Result<EmployeePlanDto>> Handle(ExceptionalApprovePlanCommand command, CancellationToken cancellationToken)
    {
        var cycleResult = await LoadOpenCycleAsync(command.CycleId, cancellationToken);
        if (cycleResult.IsFailure) return Result.Failure<EmployeePlanDto>(cycleResult.Error);
        var cycle = cycleResult.Value;

        // The governed escape hatch is tenant administration only, and never the normal manager path.
        if (!command.Actor.IsAdmin)
            return Result.Failure<EmployeePlanDto>(Error.Forbidden("Plan.ExceptionalForbidden", "Exceptional approval requires tenant performance administration."));

        var plan = await LoadPlanTrackedAsync(cycle.Id, command.PlanId, cancellationToken);
        if (plan is null) return Result.Failure<EmployeePlanDto>(Error.NotFound("Plan", command.PlanId));

        try
        {
            plan.ApproveExceptionally(command.Actor.CallerEmployeeId, command.Request.Reason);
            FixNewPlanRows();
            await Db.SaveChangesAsync(cancellationToken);
            return await ProjectAsync(cycle, plan.Id, command.Actor, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Validation("Plan.Reason", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<EmployeePlanDto>(Error.Conflict("Plan.NotApprovable", ex.Message));
        }
    }
}
