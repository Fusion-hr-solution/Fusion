using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress.Queries;

/// <summary>
/// Loads append-only progress history with committed evidence for a set of plans, most-recent-first
/// per objective. Callers own authorization (own plan for employees, effective-reviewer scope for
/// managers); this reader is scoped to the tenant by the global query filter and never mutates state.
/// </summary>
public sealed class ObjectiveProgressHistoryReader(PerformanceDbContext dbContext)
{
    /// <summary>
    /// The most recent updates per objective, bounded per objective so a long-running campaign's
    /// append-only history cannot make a workspace read grow without limit.
    /// </summary>
    /// <param name="perObjectiveLimit">
    /// How many of the most recent updates to return per objective. Clamped to
    /// <see cref="HistoryPage.MaxPageSize"/>; the full series is reachable through the paginated
    /// history read.
    /// </param>
    public async Task<Dictionary<Guid, List<ObjectiveProgressUpdateDto>>> GetHistoryByObjectiveAsync(
        IReadOnlyCollection<Guid> planIds,
        CancellationToken cancellationToken,
        int? perObjectiveLimit = null)
    {
        if (planIds.Count == 0)
            return [];

        var limit = HistoryPage.From(1, perObjectiveLimit).PageSize;

        var updates = await dbContext.ObjectiveProgressUpdates
            .AsNoTracking()
            .Where(update => planIds.Contains(update.PlanId))
            // The newest `limit` per objective, expressed as a rank the database can evaluate:
            // keep an update when fewer than `limit` updates for the same objective are newer.
            // RecordedAt then Id is the stable order, so the cut is deterministic when several
            // updates share a timestamp.
            .Where(update => dbContext.ObjectiveProgressUpdates
                .Count(newer => newer.ObjectiveId == update.ObjectiveId
                                && (newer.RecordedAt > update.RecordedAt
                                    || (newer.RecordedAt == update.RecordedAt && newer.Id > update.Id))) < limit)
            .ToListAsync(cancellationToken);

        if (updates.Count == 0)
            return [];

        var updateIds = updates.Select(update => update.Id).ToList();
        var evidence = await dbContext.Attachments
            .AsNoTracking()
            .Where(attachment => attachment.OwnerType == ObjectiveProgressRules.AttachmentOwnerType
                                 && attachment.OwnerId != null
                                 && updateIds.Contains(attachment.OwnerId!.Value)
                                 && attachment.Status == AttachmentStatus.Committed)
            .Select(attachment => new
            {
                UpdateId = attachment.OwnerId!.Value,
                Dto = new ObjectiveProgressAttachmentDto(
                    attachment.Id, attachment.FileName, attachment.ContentType, attachment.SizeBytes),
            })
            .ToListAsync(cancellationToken);

        var evidenceByUpdate = evidence
            .GroupBy(item => item.UpdateId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.Dto).ToList());

        return updates
            .GroupBy(update => update.ObjectiveId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(update => update.RecordedAt)
                    .ThenByDescending(update => update.Id)
                    .Select(update => new ObjectiveProgressUpdateDto(
                    update.Id,
                    update.ObjectiveId,
                    update.ProgressPercent,
                    update.PreviousPercent,
                    update.ActualValue,
                    update.Comment,
                    update.IsRegression,
                    update.RegressionReason,
                    update.ActorName,
                    update.RecordedAt,
                    evidenceByUpdate.GetValueOrDefault(update.Id, []))).ToList());
    }
}
