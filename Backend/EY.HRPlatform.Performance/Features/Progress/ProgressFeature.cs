using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
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
public sealed record ProgressActorContext(
    Guid CallerEmployeeId,
    bool IsAdmin,
    bool CanReviewReports,
    bool HasOrgManageGrant = false,
    bool CanPublishStrategy = false)
{
    /// <summary>The same caller as objective access decisions see them.</summary>
    public GoalActorContext ToGoalActor()
        => new(CallerEmployeeId, IsAdmin, HasOrgManageGrant, CanReviewReports, CanPublishStrategy);
}

public sealed record GetObjectiveProgressQuery(Guid CycleId, Guid ObjectiveId, ProgressActorContext Actor) : IQuery<Result<ObjectiveProgressDto>>;
public sealed record GetProgressHistoryPageQuery(Guid CycleId, Guid ObjectiveId, string? Cursor, int Limit, ProgressActorContext Actor) : IQuery<Result<ProgressHistoryPageDto>>;
public sealed record SubmitProgressCommand(Guid CycleId, Guid ObjectiveId, SubmitProgressRequest Request, ProgressActorContext Actor) : ICommand<Result<ObjectiveProgressDto>>;

/// <summary>An authorized reference to a stored evidence file, resolved after a named-detail check.</summary>
public sealed record EvidenceFileRef(string StorageKey, string FileName, string ContentType);
public sealed record ResolveEvidenceFileQuery(Guid CycleId, Guid EvidenceId, ProgressActorContext Actor) : IQuery<Result<EvidenceFileRef>>;

internal static class ProgressAuthorization
{
    /// <summary>Named progress detail (history, evidence), decided by <see cref="ObjectivePolicy"/>.</summary>
    public static async Task<bool> CanSeeNamedDetailAsync(
        PerformanceDbContext db,
        ICoreWorkforceClient workforce,
        Objective objective,
        EmployeePlan? plan,
        ProgressActorContext actor,
        CancellationToken cancellationToken, PerformanceViewer? caller = null)
    {
        var goalActor = actor.ToGoalActor();
        // Ownership, responsibility and administration need no Core lookup; only team governance does.
        if (ObjectivePolicy.CanReadProgressHistory(new CycleViewer(goalActor, null), objective, plan))
            return true;
        if (!actor.HasOrgManageGrant || objective.OwnershipScope != ObjectiveOwnershipScope.OrgUnit)
            return false;

        var cycle = await db.Cycles.AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == objective.CycleId, cancellationToken);
        if (cycle is null) return false;
        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, goalActor, cancellationToken);
        return ObjectivePolicy.CanReadProgressHistory(viewer, objective, plan);
    }
}

public sealed class ResolveEvidenceFileHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer? caller = null) : IQueryHandler<ResolveEvidenceFileQuery, Result<EvidenceFileRef>>
{
    public async Task<Result<EvidenceFileRef>> Handle(ResolveEvidenceFileQuery request, CancellationToken cancellationToken)
    {
        var item = await db.EvidenceItems.AsNoTracking().FirstOrDefaultAsync(e => e.Id == request.EvidenceId, cancellationToken);
        if (item is null || item.Kind != EvidenceKind.File || item.StorageKey is null || item.IsRemovedUnderRetention)
            return Result.Failure<EvidenceFileRef>(PerformanceErrors.NotFound("Evidence", request.EvidenceId));

        var update = await db.ProgressUpdates.AsNoTracking().FirstOrDefaultAsync(u => u.Id == item.ProgressUpdateId, cancellationToken);
        if (update is null || update.CycleId != request.CycleId)
            return Result.Failure<EvidenceFileRef>(PerformanceErrors.NotFound("Evidence", request.EvidenceId));

        var objective = await db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == update.ObjectiveId, cancellationToken);
        if (objective is null) return Result.Failure<EvidenceFileRef>(PerformanceErrors.NotFound("Evidence", request.EvidenceId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<EvidenceFileRef>(PerformanceErrors.NotFound("Cycle", request.CycleId));
        if (cycle.ClosedAt is { } closedAt)
        {
            var retentionMonths = await db.CycleSettings.Select(settings => (int?)settings.EvidenceRetentionMonths)
                .FirstOrDefaultAsync(cancellationToken) ?? 36;
            if (EvidenceRetentionPolicy.IsExpired(closedAt, retentionMonths, PerformanceClock.UtcNow))
                return Result.Failure<EvidenceFileRef>(PerformanceErrors.NotFound("Evidence", request.EvidenceId));
        }
        var viewer = await (caller ?? new PerformanceViewer(db, workforce)).ForCycleAsync(cycle, request.Actor.ToGoalActor(), cancellationToken);
        if (!EvidencePolicy.CanRead(viewer, objective, plan))
            return Result.Failure<EvidenceFileRef>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.EvidenceForbidden, "You are not authorized to open this evidence."));

        if (!item.StorageKey.StartsWith($"{item.TenantId:N}/", StringComparison.Ordinal))
            return Result.Failure<EvidenceFileRef>(PerformanceErrors.NotFound("Evidence", request.EvidenceId));

        return Result.Success(new EvidenceFileRef(item.StorageKey, item.FileName ?? "attachment", item.ContentType ?? "application/octet-stream"));
    }
}

// ── Read ─────────────────────────────────────────────────────────────────────

public sealed class GetObjectiveProgressHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer? caller = null)
    : IQueryHandler<GetObjectiveProgressQuery, Result<ObjectiveProgressDto>>
{
    public async Task<Result<ObjectiveProgressDto>> Handle(GetObjectiveProgressQuery request, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.AsNoTracking().Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == request.ObjectiveId && o.CycleId == request.CycleId, cancellationToken);
        if (objective is null) return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.NotFound("Objective", request.ObjectiveId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!await ProgressAuthorization.CanSeeNamedDetailAsync(db, workforce, objective, plan, request.Actor, cancellationToken, caller))
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ProgressViewForbidden, "You are not authorized to view this objective's progress detail."));

        var dto = await ProgressComposer.BuildAsync(db, workforce, objective, plan, request.Actor, cancellationToken);
        return Result.Success(dto);
    }
}

public sealed class GetProgressHistoryPageHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceViewer? caller = null)
    : IQueryHandler<GetProgressHistoryPageQuery, Result<ProgressHistoryPageDto>>
{
    public async Task<Result<ProgressHistoryPageDto>> Handle(GetProgressHistoryPageQuery request, CancellationToken cancellationToken)
    {
        var objective = await db.Objectives.AsNoTracking().Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == request.ObjectiveId && o.CycleId == request.CycleId, cancellationToken);
        if (objective is null) return Result.Failure<ProgressHistoryPageDto>(PerformanceErrors.NotFound("Objective", request.ObjectiveId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!await ProgressAuthorization.CanSeeNamedDetailAsync(db, workforce, objective, plan, request.Actor, cancellationToken, caller))
            return Result.Failure<ProgressHistoryPageDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ProgressViewForbidden, "You are not authorized to view this objective's progress detail."));

        var limit = request.Limit <= 0 ? ProgressComposer.HistoryPageSize : request.Limit;
        var (items, nextCursor) = await ProgressComposer.BuildHistoryPageAsync(db, workforce, objective, plan, request.Actor, request.Cursor, limit, cancellationToken);
        return Result.Success(new ProgressHistoryPageDto(items, nextCursor));
    }
}

// ── Submit ───────────────────────────────────────────────────────────────────

public sealed class SubmitProgressHandler(PerformanceDbContext db, ICoreWorkforceClient workforce, ITenantContext tenant, IPerformanceAudit audit,
    IPerformanceEvidenceStore store, IPerformanceNotifications notifications)
    : ICommandHandler<SubmitProgressCommand, Result<ObjectiveProgressDto>>
{
    public async Task<Result<ObjectiveProgressDto>> Handle(SubmitProgressCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed) return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only; progress cannot be recorded."));

        var objective = await db.Objectives.Include(o => o.Measurement)
            .FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == command.CycleId, cancellationToken);
        if (objective is null) return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));

        var plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().Include(p => p.Decisions).FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);

        if (!ProgressComposer.CanUpdate(objective, plan, command.Actor))
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ProgressUpdateForbidden, "Only the accountable owner records progress, once the objective's baseline is set."));

        if (VersionGuard.Check(objective, command.Request.ExpectedVersion) is { } stale)
            return Result.Failure<ObjectiveProgressDto>(stale);

        var request = command.Request;
        var author = command.Actor.CallerEmployeeId;
        var method = objective.Measurement?.Method;
        if (request.Status is not ObjectiveStatus status || !Enum.IsDefined(status))
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ProgressStatusRequired,
                "Choose how the objective is going."));

        var milestones = request.Milestones ?? [];
        var measurementChanges = (request.Percentage is null ? 0 : 1) + (request.NumericActual is null ? 0 : 1) + (milestones.Count == 0 ? 0 : 1);
        var mismatch = measurementChanges > 1
            || (request.Percentage is not null && method != MeasurementMethod.ManualPercentage)
            || (request.NumericActual is not null && method != MeasurementMethod.NumericTarget)
            || (milestones.Count > 0 && method != MeasurementMethod.WeightedMilestones);
        if (mismatch)
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ProgressMismatch, "The update does not match the objective's measurement method."));

        var completedBefore = (objective.Measurement?.Milestones ?? []).ToDictionary(m => m.Id, m => m.IsCompleted);
        var before = new { objective.CurrentPercentage, objective.CurrentActual };
        try
        {
            ProgressUpdate update;
            if (request.Percentage is decimal percentage)
            {
                var decreased = objective.CurrentPercentage is not null && percentage < objective.CurrentPercentage;
                update = ProgressUpdate.RecordPercentage(tenant.TenantId, cycle.Id, objective.Id, author, percentage, status, request.ContextNote, request.IsCorrection, decreased);
                objective.ApplyManualPercentage(percentage);
            }
            else if (request.NumericActual is decimal actual)
            {
                update = ProgressUpdate.RecordNumericActual(tenant.TenantId, cycle.Id, objective.Id, author, actual, status, request.ContextNote, request.IsCorrection);
                objective.ApplyNumericActual(actual);
            }
            else if (milestones.Count > 0)
            {
                var changes = milestones.Select(change => (change.MilestoneId, change.Completed)).ToList();
                update = ProgressUpdate.RecordMilestones(tenant.TenantId, cycle.Id, objective.Id, author, changes, status, request.ContextNote, request.IsCorrection);
                objective.ApplyMilestones(changes);
            }
            else
            {
                update = ProgressUpdate.RecordStatusOnly(tenant.TenantId, cycle.Id, objective.Id, author, status, request.ContextNote);
            }
            var enteredRisk = objective.ReportStatus(status, update.RecordedAt);

            foreach (var evidence in request.Evidence ?? [])
            {
                if (evidence.Kind != EvidenceKind.File)
                {
                    update.AttachEvidence(ProgressComposer.ToEvidence(evidence, tenant.TenantId));
                    continue;
                }
                var upload = evidence.UploadId is null ? null : await db.EvidenceUploads.FirstOrDefaultAsync(u =>
                    u.Id == evidence.UploadId && u.CycleId == cycle.Id && u.ObjectiveId == objective.Id
                    && u.UploaderEmployeeId == author && u.ClaimedAt == null, cancellationToken);
                if (upload is null || upload.ClaimedAt is not null)
                    return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.EvidenceUploadInvalid,
                        "This upload is unavailable for this progress update. Attach the file again."));
                await using var file = await store.OpenAsync(upload.StorageKey, cancellationToken);
                if (file is null)
                    return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.EvidenceUploadInvalid,
                        "This file is no longer available. Attach it again."));
                upload.Claim(objective.Id, author);
                update.AttachEvidence(EvidenceItem.File(upload.TenantId, upload.FileName, upload.ContentType, upload.SizeBytes, upload.StorageKey));
            }

            db.ProgressUpdates.Add(update);
            if (plan is not null)
            {
                await EY.HRPlatform.Performance.Features.Plans.UpdateRequests.SatisfyAsync(db, audit, notifications, plan, objective, update, cancellationToken);
                if (enteredRisk && plan.State == PlanLifecycleState.Approved)
                    notifications.EnqueueObjectiveAtRisk(plan, objective, status, update.Id);
            }
            var after = new { objective.CurrentPercentage, objective.CurrentActual };
            if (request.IsCorrection && update.Kind != ProgressEventKind.MilestonesChanged)
                audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ProgressCorrected,
                    new { before, after, updateId = update.Id, request.ContextNote });
            foreach (var change in update.MilestoneChanges)
            {
                var wasCompleted = completedBefore.GetValueOrDefault(change.MilestoneId);
                if (wasCompleted && !change.Completed)
                    audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.MilestoneReopened,
                        new { before = new { milestoneCompleted = true }, after = new { milestoneCompleted = false },
                            updateId = update.Id, request.ContextNote, change.MilestoneId });
                else if (request.IsCorrection && wasCompleted != change.Completed)
                    audit.Record(objective.TenantId, "Objective", objective.Id, cycle.Id, PerformanceAuditActions.ProgressCorrected,
                        new { before = new { milestoneCompleted = wasCompleted }, after = new { milestoneCompleted = change.Completed },
                            updateId = update.Id, request.ContextNote, change.MilestoneId });
            }
            await EY.HRPlatform.Performance.Features.Plans.UpdateRequestSatisfaction.SaveAsync(db, cancellationToken);

            var dto = await ProgressComposer.BuildAsync(db, workforce, objective, plan, command.Actor, cancellationToken);
            return Result.Success(dto);
        }
        catch (ProgressReasonRequiredException ex)
        {
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ProgressReasonRequired, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ProgressInvalid, ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<ObjectiveProgressDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ProgressNotUpdatable, ex.Message));
        }
    }
}
