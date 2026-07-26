using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
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
    public async Task<Dictionary<Guid, List<ObjectiveProgressUpdateDto>>> GetHistoryByObjectiveAsync(
        IReadOnlyCollection<Guid> planIds,
        CancellationToken cancellationToken)
    {
        if (planIds.Count == 0)
            return [];

        var updates = await dbContext.ObjectiveProgressUpdates
            .AsNoTracking()
            .Where(update => planIds.Contains(update.PlanId))
            .OrderByDescending(update => update.RecordedAt)
            .ThenByDescending(update => update.Id)
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
                group => group.Select(update => new ObjectiveProgressUpdateDto(
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
