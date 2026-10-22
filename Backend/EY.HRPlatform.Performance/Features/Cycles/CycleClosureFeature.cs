using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles;

public sealed record GetCycleClosureQuery(Guid CycleId) : IQuery<Result<CycleClosureDto>>;
public sealed record CloseCycleCommand(Guid CycleId, CloseCycleRequest Request) : ICommand<Result<CycleDetailDto>>;
public sealed record DeleteDraftCycleCommand(Guid CycleId, uint ExpectedVersion) : ICommand<Result<bool>>;

/// <summary>
/// What closing a Cycle involves: whether the end date is reached, and which participants have no
/// approved plan and so would be recorded as closure exceptions. Reads persisted roster and plan
/// state only — no Core call.
/// </summary>
public static class CycleClosureComposer
{
    public static DateOnly Today() => PerformanceClock.Today;

    public static async Task<CycleClosureDto> ComposeAsync(PerformanceDbContext db, PerformanceCycle cycle, CancellationToken cancellationToken)
    {
        var participants = await db.Participants.AsNoTracking()
            .Where(p => p.CycleId == cycle.Id)
            .Select(p => new { p.EmployeeId, p.DisplayName, p.OrgUnitName, p.ClosureExceptionReason })
            .ToListAsync(cancellationToken);
        var standings = await StandingsAsync(db, cycle.Id, cancellationToken);

        var unresolved = participants
            .Select(p => new ClosureParticipantDto(
                p.EmployeeId, p.DisplayName, p.OrgUnitName,
                standings.GetValueOrDefault(p.EmployeeId, RosterPlanStatus.NotStarted),
                p.ClosureExceptionReason))
            .Where(p => p.Standing != RosterPlanStatus.Approved)
            .OrderBy(p => p.Standing)
            .ThenBy(p => p.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new CycleClosureDto(
            cycle.Id,
            cycle.Version,
            cycle.State,
            cycle.EndDate,
            Today() >= cycle.EndDate,
            participants.Count,
            participants.Count - unresolved.Count,
            unresolved,
            cycle.EarlyCloseReason,
            participants.Count(p => p.ClosureExceptionReason is not null));
    }

    /// <summary>Each employee's plan standing in the Cycle; employees without a plan are absent.</summary>
    public static async Task<Dictionary<Guid, RosterPlanStatus>> StandingsAsync(PerformanceDbContext db, Guid cycleId, CancellationToken cancellationToken)
    {
        var plans = await db.EmployeePlans.AsNoTracking()
            .Where(p => p.CycleId == cycleId)
            .Select(p => new
            {
                p.EmployeeId,
                p.State,
                LastKind = p.Decisions.OrderByDescending(d => d.DecidedAt).Select(d => (PlanDecisionKind?)d.Kind).FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return plans.ToDictionary(p => p.EmployeeId, p => p.State switch
        {
            PlanLifecycleState.Approved => RosterPlanStatus.Approved,
            PlanLifecycleState.Submitted => RosterPlanStatus.Submitted,
            _ when p.LastKind == PlanDecisionKind.Returned => RosterPlanStatus.ReturnedForChanges,
            _ => RosterPlanStatus.Draft,
        });
    }
}

public sealed class GetCycleClosureHandler(PerformanceDbContext db)
    : IQueryHandler<GetCycleClosureQuery, Result<CycleClosureDto>>
{
    public async Task<Result<CycleClosureDto>> Handle(GetCycleClosureQuery request, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleClosureDto>(PerformanceErrors.NotFound("Cycle", request.CycleId));
        return await CycleClosureComposer.ComposeAsync(db, cycle, cancellationToken);
    }
}

/// <summary>
/// Closes an Active Cycle deliberately. Closing before the end date needs a reason; participants
/// without an approved plan are recorded as closure exceptions with the supplied reason. A retry
/// of an already-closed Cycle returns its current detail without changing it.
/// </summary>
public sealed class CloseCycleHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<CloseCycleCommand, Result<CycleDetailDto>>
{
    public async Task<Result<CycleDetailDto>> Handle(CloseCycleCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CycleDetailDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed)
            return await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
        if (!cycle.IsActive)
            return Result.Failure<CycleDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleNotActive, "Only an Active Cycle can be closed."));
        if (await db.ReviewRounds.AnyAsync(round => round.CycleId == cycle.Id && round.State == ReviewRoundState.Active, cancellationToken))
            return Result.Failure<CycleDetailDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleHasActiveReviewRound,
                "Close every Active review round before closing this Cycle."));
        if (VersionGuard.Check(cycle, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<CycleDetailDto>(stale);

        var standings = await CycleClosureComposer.StandingsAsync(db, cycle.Id, cancellationToken);
        var participants = await db.Participants.Where(p => p.CycleId == cycle.Id).ToListAsync(cancellationToken);
        var unresolved = participants
            .Where(p => standings.GetValueOrDefault(p.EmployeeId, RosterPlanStatus.NotStarted) != RosterPlanStatus.Approved)
            .ToList();

        var exceptionReason = command.Request.ExceptionReason?.Trim();
        if (unresolved.Count > 0 && string.IsNullOrEmpty(exceptionReason))
        {
            var names = unresolved.OrderBy(p => p.DisplayName, StringComparer.OrdinalIgnoreCase).Select(p => p.DisplayName).ToList();
            return Result.Failure<CycleDetailDto>(PerformanceErrors.InvalidState(
                PerformanceErrors.Codes.CycleClosureUnresolved,
                unresolved.Count == 1
                    ? "1 participant has no approved plan. Give a reason to close with this exception."
                    : $"{unresolved.Count} participants have no approved plan. Give a reason to close with these exceptions.",
                new { unresolvedCount = unresolved.Count, participants = names.Take(10).ToList() }));
        }

        try
        {
            cycle.CloseDeliberately(CycleClosureComposer.Today(), command.Request.EarlyCloseReason);
            foreach (var participant in unresolved)
                participant.RecordClosureException(exceptionReason!);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CycleDetailDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CycleEarlyCloseReason, ex.Message));
        }

        foreach (var participant in unresolved)
            audit.Record(cycle.TenantId, "Participant", participant.Id, cycle.Id, PerformanceAuditActions.ClosureExceptionRecorded,
                new { participant.EmployeeId, before = (string?)null, after = participant.ClosureExceptionReason });
        audit.Record(cycle.TenantId, "Cycle", cycle.Id, cycle.Id, PerformanceAuditActions.CycleClosed,
            new { before = "Active", after = "Closed", cycle.EarlyCloseReason, exceptionCount = unresolved.Count });
        await EY.HRPlatform.Performance.Features.Plans.UpdateRequests.CloseOpenAsync(db, audit, cycle.Id, PerformanceClock.UtcNow, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return await CycleDetailComposer.ComposeAsync(db, cycle, cancellationToken);
    }
}

/// <summary>
/// Deletes an unused Draft Cycle with its setup data (population, roster, draft direction). A
/// Cycle that holds any employee plan is not unused; an Active or Closed Cycle is never deleted.
/// </summary>
public sealed class DeleteDraftCycleHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<DeleteDraftCycleCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteDraftCycleCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<bool>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (!cycle.IsDraft)
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleNotDraft, "Only a Draft Cycle can be deleted. An Active Cycle is closed, not cancelled."));
        if (VersionGuard.Check(cycle, command.ExpectedVersion) is { } stale)
            return Result.Failure<bool>(stale);
        if (await db.EmployeePlans.AnyAsync(p => p.CycleId == cycle.Id, cancellationToken))
            return Result.Failure<bool>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleNotDeletable, "This Cycle already holds employee plans and cannot be deleted."));

        db.Objectives.RemoveRange(await db.Objectives.Where(o => o.CycleId == cycle.Id).ToListAsync(cancellationToken));
        db.Participants.RemoveRange(await db.Participants.Where(p => p.CycleId == cycle.Id).ToListAsync(cancellationToken));
        db.PopulationDefinitions.RemoveRange(await db.PopulationDefinitions.Where(d => d.CycleId == cycle.Id).ToListAsync(cancellationToken));
        db.Cycles.Remove(cycle);
        audit.Record(cycle.TenantId, "Cycle", cycle.Id, cycle.Id, PerformanceAuditActions.CycleDraftDeleted,
            new { before = new { state = "Draft", cycle.Name }, after = (string?)null });
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
