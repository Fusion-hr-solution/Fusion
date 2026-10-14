using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.StrategicDirection;

public sealed record ListStrategyQuery(Guid CycleId, GoalActorContext Actor) : IQuery<Result<IReadOnlyList<StrategicObjectiveDto>>>;
public sealed record CreateStrategicObjectiveCommand(Guid CycleId, CreateStrategicObjectiveRequest Request) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record UpdateStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId, UpdateStrategicObjectiveRequest Request) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record PublishStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId, uint ExpectedVersion = 0) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record ArchiveStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId, GoalActorContext Actor, uint ExpectedVersion = 0) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record DeleteStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId, uint ExpectedVersion = 0) : ICommand<Result<bool>>;

public sealed class ListStrategyHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<ListStrategyQuery, Result<IReadOnlyList<StrategicObjectiveDto>>>
{
    public async Task<Result<IReadOnlyList<StrategicObjectiveDto>>> Handle(ListStrategyQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<IReadOnlyList<StrategicObjectiveDto>>(PerformanceErrors.NotFound("Cycle", request.CycleId));

        var viewer = new CycleViewer(request.Actor, null);
        var objectives = await ObjectivePolicy.Readable(db.Objectives.AsNoTracking(), db.EmployeePlans, viewer)
            .Where(o => o.CycleId == request.CycleId && o.OwnershipScope == ObjectiveOwnershipScope.Company)
            .Include(o => o.Measurement)
            .OrderByDescending(o => o.State == ObjectiveLifecycleState.Published)
            .ThenBy(o => o.Title)
            .ToListAsync(cancellationToken);

        // Company direction needs no team context, so the viewer resolves without a Core lookup.
        var names = await ResolveAccountableNamesAsync(objectives, cycle.StartDate, workforce, cancellationToken);

        var dtos = objectives
            .Select(o => PerformanceMappers.ToDto(o, names.GetValueOrDefault(o.AccountablePersonId)))
            .ToList();
        return Result.Success<IReadOnlyList<StrategicObjectiveDto>>(dtos);
    }

    internal static async Task<Dictionary<Guid, string>> ResolveAccountableNamesAsync(
        IReadOnlyCollection<Objective> objectives,
        DateOnly asOfDate,
        ICoreWorkforceClient workforce,
        CancellationToken cancellationToken)
    {
        var ids = objectives.Select(o => o.AccountablePersonId).Distinct().ToList();
        if (ids.Count == 0) return [];

        var snapshots = await workforce.ResolveAsync(asOfDate.ToDateTime(TimeOnly.MinValue), ids, cancellationToken);
        return snapshots.ToDictionary(snapshot => snapshot.EmployeeId, snapshot => snapshot.DisplayName);
    }
}

public sealed class CreateStrategicObjectiveHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<CreateStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(CreateStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only."));

        var request = command.Request;
        if (VersionGuard.Check(cycle, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<StrategicObjectiveDto>(stale);

        try
        {
            var measurement = PerformanceMappers.ToMeasurement(request.Measurement, tenant.TenantId);
            var objective = Objective.CreateStrategic(
                tenant.TenantId,
                cycle.Id,
                request.Title,
                request.Description,
                request.AccountablePersonId,
                request.StartDate ?? cycle.StartDate,
                request.EndDate ?? cycle.EndDate,
                measurement,
                cycle.StartDate,
                cycle.EndDate);

            if (request.Publish)
                objective.Publish();

            db.Objectives.Add(objective);
            if (cycle.IsDraft) cycle.Touch();
            if (request.Publish)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectivePublished,
                    new { before = "Draft", after = "Published" });
            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.StrategicObjectiveNotPublishable, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.StrategicObjectiveInvalid, ex.Message));
        }
    }
}

public sealed class UpdateStrategicObjectiveHandler(PerformanceDbContext db, ITenantContext tenant, IPerformanceAudit audit)
    : ICommandHandler<UpdateStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(UpdateStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));

        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId
                && o.OwnershipScope == ObjectiveOwnershipScope.Company, cancellationToken);
        if (objective is null)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("StrategicObjective", command.ObjectiveId));

        if (cycle.IsClosed)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only."));

        var request = command.Request;
        if (VersionGuard.Check(objective, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<StrategicObjectiveDto>(stale);

        try
        {
            var measurement = PerformanceMappers.ToMeasurement(request.Measurement, tenant.TenantId);
            objective.UpdateStrategicDetails(
                request.Title,
                request.Description,
                request.AccountablePersonId,
                request.StartDate,
                request.EndDate,
                measurement,
                cycle.StartDate,
                cycle.EndDate);

            if (request.Publish)
                objective.Publish();

            if (cycle.IsDraft) cycle.Touch();
            if (request.Publish)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectivePublished,
                    new { before = "Draft", after = "Published" });
            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.StrategicObjectiveInvalid, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.StrategicObjectiveNotEditable, ex.Message));
        }
    }
}

public sealed class PublishStrategicObjectiveHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<PublishStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(PublishStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only."));

        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId
                && o.OwnershipScope == ObjectiveOwnershipScope.Company, cancellationToken);
        if (objective is null)
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("StrategicObjective", command.ObjectiveId));

        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale)
            return Result.Failure<StrategicObjectiveDto>(stale);

        try
        {
            var before = objective.State;
            objective.Publish();
            if (cycle.IsDraft) cycle.Touch();
            if (before != objective.State)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectivePublished,
                    new { before = before.ToString(), after = objective.State.ToString() });
            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.StrategicObjectiveNotPublishable, ex.Message));
        }
    }
}

public sealed class DeleteStrategicObjectiveHandler(PerformanceDbContext db)
    : ICommandHandler<DeleteStrategicObjectiveCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<bool>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed)
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only."));

        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId
                && o.OwnershipScope == ObjectiveOwnershipScope.Company, cancellationToken);
        if (objective is null)
            return Result.Failure<bool>(PerformanceErrors.NotFound("StrategicObjective", command.ObjectiveId));
        if (objective.State != ObjectiveLifecycleState.Draft)
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.StrategicObjectiveNotDraft, "Only a Draft strategic objective can be removed."));

        if (await db.Objectives.AnyAsync(o => o.ParentObjectiveId == objective.Id, cancellationToken))
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.StrategicObjectiveHasChildren, "Remove aligned objectives before removing their direction."));

        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale)
            return Result.Failure<bool>(stale);

        if (cycle.IsDraft) cycle.Touch();
        db.Objectives.Remove(objective);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(true);
    }
}

public sealed class ArchiveStrategicObjectiveHandler(PerformanceDbContext db, IPerformanceAudit audit) : ICommandHandler<ArchiveStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(ArchiveStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        var objective = await db.Objectives.Include(o => o.Measurement).FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == cycle.Id && o.OwnershipScope == ObjectiveOwnershipScope.Company, cancellationToken);
        if (objective is null) return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.NotFound("StrategicObjective", command.ObjectiveId));
        if (!ObjectivePolicy.CanGovern(new CycleViewer(command.Actor, null), objective))
            return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ObjectiveArchiveForbidden, "You are not authorized to archive this objective."));
        if (cycle.IsClosed) return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only."));
        if (objective.State == ObjectiveLifecycleState.Archived) return PerformanceMappers.ToDto(objective, null);
        if (VersionGuard.Check(objective, command.ExpectedVersion) is { } stale) return Result.Failure<StrategicObjectiveDto>(stale);
        try
        {
            objective.Archive();
            if (cycle.IsDraft) cycle.Touch();
            audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ObjectiveArchived,
                new { before = "Published", after = "Archived", objective.ArchivedAt });
            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (InvalidOperationException ex) { return Result.Failure<StrategicObjectiveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ObjectiveNotArchivable, ex.Message)); }
    }
}
