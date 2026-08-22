using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.StrategicDirection;

public sealed record ListStrategyQuery(Guid CycleId) : IQuery<Result<IReadOnlyList<StrategicObjectiveDto>>>;
public sealed record CreateStrategicObjectiveCommand(Guid CycleId, CreateStrategicObjectiveRequest Request) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record UpdateStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId, UpdateStrategicObjectiveRequest Request) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record PublishStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId) : ICommand<Result<StrategicObjectiveDto>>;
public sealed record DeleteStrategicObjectiveCommand(Guid CycleId, Guid ObjectiveId) : ICommand<Result<bool>>;

public sealed class ListStrategyHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<ListStrategyQuery, Result<IReadOnlyList<StrategicObjectiveDto>>>
{
    public async Task<Result<IReadOnlyList<StrategicObjectiveDto>>> Handle(ListStrategyQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<IReadOnlyList<StrategicObjectiveDto>>(Error.NotFound("Cycle", request.CycleId));

        var objectives = await db.Objectives
            .AsNoTracking()
            .Where(o => o.CycleId == request.CycleId && o.OwnershipScope == ObjectiveOwnershipScope.Company)
            .Include(o => o.Measurement)
            .OrderByDescending(o => o.State == ObjectiveLifecycleState.Published)
            .ThenBy(o => o.Title)
            .ToListAsync(cancellationToken);

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

public sealed class CreateStrategicObjectiveHandler(PerformanceDbContext db, ITenantContext tenant)
    : ICommandHandler<CreateStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(CreateStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<StrategicObjectiveDto>(Error.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed)
            return Result.Failure<StrategicObjectiveDto>(Error.Conflict("Cycle.Closed", "A Closed Cycle is read-only."));

        var request = command.Request;
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

            db.Objectives.Add(objective);
            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(Error.Validation("StrategicObjective.Invalid", ex.Message));
        }
    }
}

public sealed class UpdateStrategicObjectiveHandler(PerformanceDbContext db, ITenantContext tenant)
    : ICommandHandler<UpdateStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(UpdateStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<StrategicObjectiveDto>(Error.NotFound("Cycle", command.CycleId));

        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId, cancellationToken);
        if (objective is null)
            return Result.Failure<StrategicObjectiveDto>(Error.NotFound("StrategicObjective", command.ObjectiveId));

        var request = command.Request;
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

            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(Error.Validation("StrategicObjective.Invalid", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(Error.Conflict("StrategicObjective.NotEditable", ex.Message));
        }
    }
}

public sealed class PublishStrategicObjectiveHandler(PerformanceDbContext db)
    : ICommandHandler<PublishStrategicObjectiveCommand, Result<StrategicObjectiveDto>>
{
    public async Task<Result<StrategicObjectiveDto>> Handle(PublishStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId, cancellationToken);
        if (objective is null)
            return Result.Failure<StrategicObjectiveDto>(Error.NotFound("StrategicObjective", command.ObjectiveId));

        try
        {
            objective.Publish();
            await db.SaveChangesAsync(cancellationToken);
            return PerformanceMappers.ToDto(objective, null);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<StrategicObjectiveDto>(Error.Conflict("StrategicObjective.NotPublishable", ex.Message));
        }
    }
}

public sealed class DeleteStrategicObjectiveHandler(PerformanceDbContext db)
    : ICommandHandler<DeleteStrategicObjectiveCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteStrategicObjectiveCommand command, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId, cancellationToken);
        if (objective is null)
            return Result.Failure<bool>(Error.NotFound("StrategicObjective", command.ObjectiveId));
        if (objective.State != ObjectiveLifecycleState.Draft)
            return Result.Failure<bool>(Error.Conflict("StrategicObjective.NotDraft", "Only a Draft strategic objective can be removed."));

        db.Objectives.Remove(objective);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(true);
    }
}
