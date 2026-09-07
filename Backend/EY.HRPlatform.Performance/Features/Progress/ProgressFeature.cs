using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress;

/// <summary>
/// The caller's contextual inputs for progress actions. Owner-only updates gate on objective
/// accountability (self for an employee objective); named-detail visibility (evidence, history)
/// gates on ownership, the responsible-manager relationship, or tenant administration.
/// </summary>
public sealed record ProgressActorContext(Guid CallerEmployeeId, bool IsAdmin, bool CanReviewReports);

public sealed record GetObjectiveProgressQuery(Guid CycleId, Guid ObjectiveId, ProgressActorContext Actor) : IQuery<Result<ObjectiveProgressDto>>;
public sealed record GetProgressHistoryPageQuery(Guid CycleId, Guid ObjectiveId, string? Cursor, int Limit, ProgressActorContext Actor) : IQuery<Result<ProgressHistoryPageDto>>;
public sealed record SubmitProgressCommand(Guid CycleId, Guid ObjectiveId, SubmitProgressRequest Request, ProgressActorContext Actor) : ICommand<Result<ObjectiveProgressDto>>;

/// <summary>An authorized reference to a stored evidence file, resolved after a named-detail check.</summary>
public sealed record EvidenceFileRef(string StorageKey, string FileName, string ContentType);
public sealed record ResolveEvidenceFileQuery(Guid CycleId, Guid EvidenceId, ProgressActorContext Actor) : IQuery<Result<EvidenceFileRef>>;

public sealed class ResolveEvidenceFileHandler(PerformanceDbContext db) : IQueryHandler<ResolveEvidenceFileQuery, Result<EvidenceFileRef>>
{
    public async Task<Result<EvidenceFileRef>> Handle(ResolveEvidenceFileQuery request, CancellationToken cancellationToken)
    {
        var item = await db.EvidenceItems.AsNoTracking().FirstOrDefaultAsync(e => e.Id == request.EvidenceId, cancellationToken);
        if (item is null || item.Kind != EvidenceKind.File || item.StorageKey is null)
            return Result.Failure<EvidenceFileRef>(Error.NotFound("Evidence", request.EvidenceId));

        var update = await db.ProgressUpdates.AsNoTracking().FirstOrDefaultAsync(u => u.Id == item.ProgressUpdateId, cancellationToken);
        if (update is null || update.CycleId != request.CycleId)
            return Result.Failure<EvidenceFileRef>(Error.NotFound("Evidence", request.EvidenceId));

        var objective = await db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == update.ObjectiveId, cancellationToken);
        if (objective is null) return Result.Failure<EvidenceFileRef>(Error.NotFound("Evidence", request.EvidenceId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!ProgressComposer.CanSeeNamedDetail(objective, plan, request.Actor))
            return Result.Failure<EvidenceFileRef>(Error.Forbidden("Evidence.Forbidden", "You are not authorized to open this evidence."));

        return Result.Success(new EvidenceFileRef(item.StorageKey, item.FileName ?? "attachment", item.ContentType ?? "application/octet-stream"));
    }
}

// ── Read ─────────────────────────────────────────────────────────────────────

public sealed class GetObjectiveProgressHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetObjectiveProgressQuery, Result<ObjectiveProgressDto>>
{
    public async Task<Result<ObjectiveProgressDto>> Handle(GetObjectiveProgressQuery request, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.AsNoTracking().Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == request.ObjectiveId && o.CycleId == request.CycleId, cancellationToken);
        if (objective is null) return Result.Failure<ObjectiveProgressDto>(Error.NotFound("Objective", request.ObjectiveId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!ProgressComposer.CanSeeNamedDetail(objective, plan, request.Actor))
            return Result.Failure<ObjectiveProgressDto>(Error.Forbidden("Progress.ViewForbidden", "You are not authorized to view this objective's progress detail."));

        var dto = await ProgressComposer.BuildAsync(db, workforce, objective, plan, request.Actor, cancellationToken);
        return Result.Success(dto);
    }
}

public sealed class GetProgressHistoryPageHandler(PerformanceDbContext db, ICoreWorkforceClient workforce)
    : IQueryHandler<GetProgressHistoryPageQuery, Result<ProgressHistoryPageDto>>
{
    public async Task<Result<ProgressHistoryPageDto>> Handle(GetProgressHistoryPageQuery request, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.AsNoTracking().Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == request.ObjectiveId && o.CycleId == request.CycleId, cancellationToken);
        if (objective is null) return Result.Failure<ProgressHistoryPageDto>(Error.NotFound("Objective", request.ObjectiveId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!ProgressComposer.CanSeeNamedDetail(objective, plan, request.Actor))
            return Result.Failure<ProgressHistoryPageDto>(Error.Forbidden("Progress.ViewForbidden", "You are not authorized to view this objective's progress detail."));

        var limit = request.Limit <= 0 ? ProgressComposer.HistoryPageSize : request.Limit;
        var (items, nextCursor) = await ProgressComposer.BuildHistoryPageAsync(db, workforce, objective, plan, request.Actor, request.Cursor, limit, cancellationToken);
        return Result.Success(new ProgressHistoryPageDto(items, nextCursor));
    }
}

// ── Submit ───────────────────────────────────────────────────────────────────

public sealed class SubmitProgressHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant)
    : ICommandHandler<SubmitProgressCommand, Result<ObjectiveProgressDto>>
{
    public async Task<Result<ObjectiveProgressDto>> Handle(SubmitProgressCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<ObjectiveProgressDto>(Error.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed) return Result.Failure<ObjectiveProgressDto>(Error.Conflict("Cycle.Closed", "A Closed Cycle is read-only; progress cannot be recorded."));

        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId, cancellationToken);
        if (objective is null) return Result.Failure<ObjectiveProgressDto>(Error.NotFound("Objective", command.ObjectiveId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!ProgressComposer.CanUpdate(objective, plan, command.Actor))
            return Result.Failure<ObjectiveProgressDto>(Error.Forbidden("Progress.UpdateForbidden", "Only the accountable owner records progress, once the objective's baseline is set."));

        var request = command.Request;
        var author = command.Actor.CallerEmployeeId;
        var method = objective.Measurement?.Method;

        try
        {
            ProgressUpdate update;
            if (method == MeasurementMethod.ManualPercentage && request.Percentage is not null)
            {
                var decreased = objective.CurrentPercentage is not null && request.Percentage < objective.CurrentPercentage;
                update = ProgressUpdate.RecordPercentage(tenant.TenantId, cycle.Id, objective.Id, author, request.Percentage.Value, request.ContextNote, request.IsCorrection, decreased);
                objective.ApplyManualPercentage(request.Percentage.Value);
            }
            else if (method == MeasurementMethod.NumericTarget && request.NumericActual is not null)
            {
                update = ProgressUpdate.RecordNumericActual(tenant.TenantId, cycle.Id, objective.Id, author, request.NumericActual.Value, request.ContextNote, request.IsCorrection);
                objective.ApplyNumericActual(request.NumericActual.Value);
            }
            else if (method == MeasurementMethod.WeightedMilestones && request.MilestoneId is not null && request.MilestoneCompleted is not null)
            {
                update = ProgressUpdate.RecordMilestone(tenant.TenantId, cycle.Id, objective.Id, author, request.MilestoneId.Value, request.MilestoneCompleted.Value, request.ContextNote, request.IsCorrection);
                objective.ApplyMilestone(request.MilestoneId.Value, request.MilestoneCompleted.Value);
            }
            else
            {
                return Result.Failure<ObjectiveProgressDto>(Error.Validation("Progress.Mismatch", "The update does not match the objective's measurement method."));
            }

            foreach (var evidence in request.Evidence ?? [])
                update.AttachEvidence(ProgressComposer.ToEvidence(evidence, tenant.TenantId));

            db.ProgressUpdates.Add(update);
            await db.SaveChangesAsync(cancellationToken);

            var dto = await ProgressComposer.BuildAsync(db, workforce, objective, plan, command.Actor, cancellationToken);
            return Result.Success(dto);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ObjectiveProgressDto>(Error.Validation("Progress.Invalid", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<ObjectiveProgressDto>(Error.Conflict("Progress.NotUpdatable", ex.Message));
        }
    }
}
