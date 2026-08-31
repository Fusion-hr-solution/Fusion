using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress;

/// <summary>
/// Builds the objective progress surface — current derived state, the append-only history in business
/// language, and evidence with a download path only where named-detail authorization holds — and
/// holds the progress authorization helpers. Never exposes raw event payloads; a never-reported
/// objective is surfaced as missing, not a reported 0.
/// </summary>
public static class ProgressComposer
{
    public static async Task<ObjectiveProgressDto> BuildAsync(
        PerformanceDbContext db, ICoreWorkforceClient workforce, Objective objective, EmployeePlan? plan, ProgressActorContext actor, CancellationToken cancellationToken)
    {
        var updates = await db.ProgressUpdates.AsNoTracking()
            .Include(u => u.Evidence)
            .Where(u => u.ObjectiveId == objective.Id)
            .OrderByDescending(u => u.RecordedAt)
            .ToListAsync(cancellationToken);

        var authorIds = updates.Select(u => u.AuthorEmployeeId).Distinct().ToList();
        var names = new Dictionary<Guid, string>();
        if (authorIds.Count > 0)
        {
            var snapshots = await workforce.ResolveAsync(DateTime.UtcNow, authorIds, cancellationToken);
            foreach (var snapshot in snapshots) names[snapshot.EmployeeId] = snapshot.DisplayName;
        }

        var milestones = objective.Measurement?.Milestones ?? [];
        var milestoneTitles = milestones.ToDictionary(m => m.Id, m => m.Title);

        var canSeeNamedDetail = CanSeeNamedDetail(objective, plan, actor);
        var history = updates.Select(update => new ProgressUpdateDto(
            update.Id,
            update.Kind,
            update.Value,
            update.MilestoneId,
            update.MilestoneId is not null ? milestoneTitles.GetValueOrDefault(update.MilestoneId.Value) : null,
            update.ContextNote,
            update.IsCorrection,
            new PersonRefDto(update.AuthorEmployeeId, names.GetValueOrDefault(update.AuthorEmployeeId)),
            update.RecordedAt,
            update.Evidence.Select(item => ToEvidenceDto(item, objective.CycleId, canSeeNamedDetail)).ToList()))
            .ToList();

        var measurement = objective.Measurement;
        return new ObjectiveProgressDto(
            objective.Id,
            objective.Title,
            objective.OwnershipScope,
            measurement?.Method ?? MeasurementMethod.ManualPercentage,
            objective.HasProgress,
            decimal.Round(objective.DerivedProgress, 2),
            objective.CurrentPercentage,
            objective.CurrentActual,
            measurement?.Baseline,
            measurement?.Target,
            measurement?.Unit,
            measurement?.Direction,
            milestones.Select(m => new ProgressMilestoneDto(m.Id, m.Title, m.Weight, m.IsCompleted)).ToList(),
            CanUpdate(objective, plan, actor),
            history);
    }

    public static EvidenceItem ToEvidence(EvidenceInput input, Guid tenantId)
        => input.Kind switch
        {
            EvidenceKind.File => EvidenceItem.File(
                tenantId,
                input.FileName ?? "attachment",
                input.ContentType ?? "application/octet-stream",
                input.SizeBytes ?? 0,
                input.StorageKey ?? throw new ArgumentException("A file evidence item requires a storage key.")),
            EvidenceKind.Link => EvidenceItem.Link(tenantId, input.Url ?? throw new ArgumentException("A link evidence item requires a URL."), input.Label),
            EvidenceKind.Reference => EvidenceItem.Reference(tenantId, input.ReferenceText ?? throw new ArgumentException("A reference evidence item requires text.")),
            _ => throw new ArgumentOutOfRangeException(nameof(input)),
        };

    private static EvidenceDto ToEvidenceDto(EvidenceItem item, Guid cycleId, bool canSeeNamedDetail)
        => new(
            item.Id,
            item.Kind,
            item.FileName,
            item.ContentType,
            item.SizeBytes,
            item.Url,
            item.ReferenceText,
            // A file's download action is exposed only where named-detail authorization holds.
            item.Kind == EvidenceKind.File && canSeeNamedDetail
                ? $"/performance/cycles/{cycleId}/evidence/{item.Id}"
                : null);

    // ── Authorization ────────────────────────────────────────────────────────

    /// <summary>Only the accountable owner records progress, and only once the objective's baseline is set.</summary>
    public static bool CanUpdate(Objective objective, EmployeePlan? plan, ProgressActorContext actor)
    {
        if (objective.AccountablePersonId != actor.CallerEmployeeId) return false;
        return objective.OwnershipScope switch
        {
            ObjectiveOwnershipScope.Employee => plan is not null && plan.State == PlanLifecycleState.Approved,
            ObjectiveOwnershipScope.OrgUnit => objective.State == ObjectiveLifecycleState.Published,
            ObjectiveOwnershipScope.Company => objective.State == ObjectiveLifecycleState.Published,
            _ => false,
        };
    }

    /// <summary>Named detail (evidence, individual history) requires ownership, responsibility, or administration.</summary>
    public static bool CanSeeNamedDetail(Objective objective, EmployeePlan? plan, ProgressActorContext actor)
    {
        if (actor.IsAdmin) return true;
        if (objective.AccountablePersonId == actor.CallerEmployeeId) return true;
        // The responsible manager of an employee objective's plan may see named detail.
        if (plan is not null && actor.CanReviewReports && plan.ResponsibleManagerId == actor.CallerEmployeeId) return true;
        return false;
    }
}
