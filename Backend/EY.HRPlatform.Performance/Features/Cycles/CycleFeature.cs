using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles;

public sealed record ListCyclesQuery : IQuery<Result<IReadOnlyList<CycleSummaryDto>>>;
public sealed record GetCurrentCycleDetailQuery : IQuery<Result<CycleDetailDto?>>;
public sealed record GetCycleDetailQuery(Guid CycleId) : IQuery<Result<CycleDetailDto>>;
public sealed record CreateCycleCommand(CreateCycleRequest Request) : ICommand<Result<CycleSummaryDto>>;
public sealed record UpdateCycleCommand(Guid CycleId, UpdateCycleRequest Request) : ICommand<Result<CycleSummaryDto>>;
public sealed record ActivateCycleCommand(Guid CycleId) : ICommand<Result<CycleDetailDto>>;

public sealed class ListCyclesHandler(PerformanceDbContext db)
    : IQueryHandler<ListCyclesQuery, Result<IReadOnlyList<CycleSummaryDto>>>
{
    public async Task<Result<IReadOnlyList<CycleSummaryDto>>> Handle(ListCyclesQuery request, CancellationToken cancellationToken)
    {
        var cycles = await db.Cycles
            .AsNoTracking()
            .OrderByDescending(cycle => cycle.State == CycleLifecycleState.Active)
            .ThenByDescending(cycle => cycle.StartDate)
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<CycleSummaryDto>>(cycles.Select(PerformanceMappers.ToSummary).ToList());
    }
}

public sealed class GetCurrentCycleDetailHandler(PerformanceDbContext db)
    : IQueryHandler<GetCurrentCycleDetailQuery, Result<CycleDetailDto?>>
{
    // The tenant's one living Cycle for the workspace landing surface: the Active
    // one if any, otherwise the most recent by start date. This is the same rule
    // the client's selectPrimaryCycle applies to the list, resolved server-side so
    // the overview reads the primary Cycle's composed detail directly — no
    // list→detail round-trip. Returns null (a valid empty state) when none exists.
    public async Task<Result<CycleDetailDto?>> Handle(GetCurrentCycleDetailQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles
            .AsNoTracking()
            .OrderByDescending(c => c.State == CycleLifecycleState.Active)
            .ThenByDescending(c => c.StartDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (cycle is null)
            return Result.Success<CycleDetailDto?>(null);

        var detail = await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
        return Result.Success<CycleDetailDto?>(detail);
    }
}

public sealed class GetCycleDetailHandler(PerformanceDbContext db)
    : IQueryHandler<GetCycleDetailQuery, Result<CycleDetailDto>>
{
    public async Task<Result<CycleDetailDto>> Handle(GetCycleDetailQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleDetailDto>(Error.NotFound("Cycle", request.CycleId));

        var detail = await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
        return detail;
    }
}

public sealed class CreateCycleHandler(PerformanceDbContext db, ITenantContext tenant)
    : ICommandHandler<CreateCycleCommand, Result<CycleSummaryDto>>
{
    public async Task<Result<CycleSummaryDto>> Handle(CreateCycleCommand command, CancellationToken cancellationToken)
    {
        var request = command.Request;
        var planningDeadline = request.PlanningDeadline ?? DerivePlanningDeadline(request.StartDate, request.EndDate);

        PerformanceCycle cycle;
        try
        {
            cycle = PerformanceCycle.CreateDraft(tenant.TenantId, request.Name, request.StartDate, request.EndDate, planningDeadline);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleSummaryDto>(Error.Validation("Cycle.Invalid", ex.Message));
        }

        db.Cycles.Add(cycle);
        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToSummary(cycle);
    }

    private static DateOnly DerivePlanningDeadline(DateOnly start, DateOnly end)
    {
        var candidate = start.AddDays(30);
        return candidate <= end ? candidate : start.AddDays(1) <= end ? start.AddDays(1) : end;
    }
}

public sealed class UpdateCycleHandler(PerformanceDbContext db)
    : ICommandHandler<UpdateCycleCommand, Result<CycleSummaryDto>>
{
    public async Task<Result<CycleSummaryDto>> Handle(UpdateCycleCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleSummaryDto>(Error.NotFound("Cycle", command.CycleId));
        if (!cycle.IsDraft)
            return Result.Failure<CycleSummaryDto>(Error.Conflict("Cycle.NotDraft", "Only a Draft Cycle can be edited."));

        var request = command.Request;
        try
        {
            cycle.UpdateDraftDetails(request.Name, request.StartDate, request.EndDate, request.PlanningDeadline);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleSummaryDto>(Error.Validation("Cycle.Invalid", ex.Message));
        }

        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToSummary(cycle);
    }
}

public sealed class ActivateCycleHandler(PerformanceDbContext db)
    : ICommandHandler<ActivateCycleCommand, Result<CycleDetailDto>>
{
    public async Task<Result<CycleDetailDto>> Handle(ActivateCycleCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleDetailDto>(Error.NotFound("Cycle", command.CycleId));
        if (!cycle.IsDraft)
            return Result.Failure<CycleDetailDto>(Error.Conflict("Cycle.NotDraft", "Only a Draft Cycle can be activated."));

        var blockers = await CycleDetailComposer.ResolveBlockersAsync(db, cycle, cancellationToken);
        if (blockers.Count > 0)
            return Result.Failure<CycleDetailDto>(Error.Conflict("Cycle.NotActivatable", string.Join(" ", blockers)));

        var settings = await db.CycleSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken)
            ?? CycleSettings.CreateDefault(cycle.TenantId);
        var participants = await db.Participants.AsNoTracking()
            .Where(p => p.CycleId == cycle.Id)
            .OrderBy(p => p.DisplayName)
            .ToListAsync(cancellationToken);
        var publishedStrategy = await db.Objectives.AsNoTracking()
            .Where(o => o.CycleId == cycle.Id && o.State == ObjectiveLifecycleState.Published)
            .OrderBy(o => o.Title)
            .ToListAsync(cancellationToken);
        var definition = await db.PopulationDefinitions.AsNoTracking().FirstOrDefaultAsync(d => d.CycleId == cycle.Id, cancellationToken);

        var snapshot = ActivationSnapshot.Capture(
            cycle.TenantId,
            cycle.Id,
            cycle.Name,
            cycle.StartDate,
            cycle.EndDate,
            cycle.PlanningDeadline,
            definition?.EligibilityDate ?? cycle.StartDate,
            participants.Count,
            JsonSerializer.Serialize(settings.ToSnapshot()),
            JsonSerializer.Serialize(new { definition?.Mode, InclusionCount = definition?.Inclusions.Count ?? 0, ExclusionCount = definition?.Exclusions.Count ?? 0 }),
            JsonSerializer.Serialize(participants.Select(p => new { p.EmployeeId, p.DisplayName, p.OrgUnitName, p.ManagerDisplayName })),
            JsonSerializer.Serialize(publishedStrategy.Select(o => new { o.Id, o.Title, o.AccountablePersonId })));

        cycle.Activate(snapshot);
        // The snapshot is a brand-new 1:1 child with a client-generated key reachable from the
        // already-tracked Cycle; EF's graph detection would otherwise assume it exists and try to
        // UPDATE a missing row. It is always new here, so mark it added explicitly.
        db.Entry(snapshot).State = EntityState.Added;
        await db.SaveChangesAsync(cancellationToken);

        return await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
    }
}
