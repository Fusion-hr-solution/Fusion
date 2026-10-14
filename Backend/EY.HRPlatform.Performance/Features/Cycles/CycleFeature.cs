using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
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

public sealed record GetCycleDetailQuery(Guid CycleId, CycleVisibilityActor Actor) : IQuery<Result<CycleDetailDto>>;
public sealed record CreateCycleCommand(CreateCycleRequest Request) : ICommand<Result<CycleSummaryDto>>;
public sealed record UpdateCycleCommand(Guid CycleId, UpdateCycleRequest Request) : ICommand<Result<CycleSummaryDto>>;
public sealed record ActivateCycleCommand(Guid CycleId, uint ExpectedVersion = 0) : ICommand<Result<CycleDetailDto>>;

public sealed class GetCycleDetailHandler(PerformanceDbContext db)
    : IQueryHandler<GetCycleDetailQuery, Result<CycleDetailDto>>
{
    public async Task<Result<CycleDetailDto>> Handle(GetCycleDetailQuery request, CancellationToken cancellationToken)
    {
        var cycle = await CyclePolicy.Visible(db.Cycles.AsNoTracking(), db.Participants.AsNoTracking(),
                db.PerformanceReviews.AsNoTracking(), request.Actor)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleDetailDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));

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

        // The planning-deadline default is tenant policy, not a magic constant: honour an explicit
        // client value, otherwise offset the start date by the tenant's configured offset.
        var settings = await db.CycleSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken)
            ?? CycleSettings.CreateDefault(tenant.TenantId);
        var planningDeadline = request.PlanningDeadline
            ?? DerivePlanningDeadline(request.StartDate, request.EndDate, settings.PlanningDeadlineOffsetDays);

        PerformanceCycle cycle;
        try
        {
            cycle = PerformanceCycle.CreateDraft(tenant.TenantId, request.Name, request.StartDate, request.EndDate, planningDeadline, request.Description);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleSummaryDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CycleInvalid, ex.Message));
        }

        db.Cycles.Add(cycle);
        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToSummary(cycle);
    }

    private static DateOnly DerivePlanningDeadline(DateOnly start, DateOnly end, int offsetDays)
    {
        var candidate = start.AddDays(offsetDays);
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
            return Result.Failure<CycleSummaryDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (!cycle.IsDraft)
            return Result.Failure<CycleSummaryDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleNotDraft, "Only a Draft Cycle can be edited."));

        if (VersionGuard.Check(cycle, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<CycleSummaryDto>(stale);

        var request = command.Request;
        var previousStart = cycle.StartDate;
        try
        {
            cycle.UpdateDraftDetails(request.Name, request.StartDate, request.EndDate, request.PlanningDeadline, request.Description);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleSummaryDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CycleInvalid, ex.Message));
        }

        // Population is resolved as-of the Cycle start date. Moving the start date invalidates any
        // confirmed roster, so realign the eligibility date, drop the confirmation, and clear the
        // frozen participant rows — the population must then be re-resolved and re-confirmed.
        // Name/description/end/deadline edits leave a confirmed population untouched.
        if (request.StartDate != previousStart)
        {
            var definition = await db.PopulationDefinitions.FirstOrDefaultAsync(d => d.CycleId == cycle.Id, cancellationToken);
            if (definition is not null)
            {
                definition.RealignEligibility(request.StartDate);
                var participants = await db.Participants.Where(p => p.CycleId == cycle.Id).ToListAsync(cancellationToken);
                if (participants.Count > 0)
                    db.Participants.RemoveRange(participants);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return PerformanceMappers.ToSummary(cycle);
    }
}

public sealed class ActivateCycleHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<ActivateCycleCommand, Result<CycleDetailDto>>
{
    public async Task<Result<CycleDetailDto>> Handle(ActivateCycleCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.Include(c => c.ActivationSnapshot).FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleDetailDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsActive && cycle.ActivationSnapshot is not null)
            return await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
        if (!cycle.IsDraft)
            return Result.Failure<CycleDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleNotDraft, "Only a Draft Cycle can be activated."));

        if (VersionGuard.Check(cycle, command.ExpectedVersion) is { } stale)
            return Result.Failure<CycleDetailDto>(stale);

        var blockers = await CycleDetailComposer.ResolveBlockersAsync(db, cycle, cancellationToken);
        if (blockers.Count > 0)
            return Result.Failure<CycleDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleNotActivatable, string.Join(" ", blockers)));

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
            JsonSerializer.Serialize(participants.Select(p => new { p.EmployeeId, p.DisplayName, p.OrgUnitId, p.OrgUnitName, ReviewerEmployeeId = p.ManagerEmployeeId, p.ManagerDisplayName, ReviewerBasis = p.ReviewerBasis.ToString(), p.ReviewerAsOf })),
            JsonSerializer.Serialize(publishedStrategy.Select(o => new { o.Id, o.Title, o.AccountablePersonId })));

        cycle.Activate(snapshot);
        // The snapshot is a brand-new 1:1 child with a client-generated key reachable from the
        // already-tracked Cycle; EF's graph detection would otherwise assume it exists and try to
        // UPDATE a missing row. It is always new here, so mark it added explicitly.
        db.Entry(snapshot).State = EntityState.Added;
        audit.Record(cycle.TenantId, "Cycle", cycle.Id, cycle.Id, PerformanceAuditActions.CycleActivated,
            new { before = "Draft", after = "Active", snapshotId = snapshot.Id, participantCount = participants.Count });
        await db.SaveChangesAsync(cancellationToken);

        return await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
    }
}
