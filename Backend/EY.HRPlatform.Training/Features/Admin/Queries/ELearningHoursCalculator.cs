using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>
/// Estimated e-learning duration per training (US-8.2.1). A training's hours are the sum of its
/// content blocks' <see cref="ContentBlock.EstimatedDurationMinutes"/>; when a training has no
/// authored duration at all, a coarse 0.5h-per-chapter fallback stands in so a completed training
/// is never reported as zero. Shared by the admin hours report and the learner "my hours" widget so
/// the two always agree.
/// </summary>
internal static class ELearningHoursCalculator
{
    private const double FallbackHoursPerChapter = 0.5;

    /// <summary>Builds a map of e-learning trainingId → estimated hours.</summary>
    public static async Task<Dictionary<Guid, double>> LoadAsync(
        TrainingDbContext db, CancellationToken cancellationToken)
    {
        var eLearningTrainingIds = await db.Set<TrainingCourse>()
            .AsNoTracking()
            .Where(t => !t.IsDeleted && t.TrainingType == TrainingType.ELearning)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        if (eLearningTrainingIds.Count == 0)
            return new Dictionary<Guid, double>();

        var minutesByTraining = await db.Set<ContentBlock>()
            .AsNoTracking()
            .Where(cb => eLearningTrainingIds.Contains(cb.Chapter.TrainingId))
            .GroupBy(cb => cb.Chapter.TrainingId)
            .Select(g => new { TrainingId = g.Key, Minutes = g.Sum(cb => (int?)cb.EstimatedDurationMinutes) ?? 0 })
            .ToListAsync(cancellationToken);

        var chaptersByTraining = await db.Set<TrainingChapter>()
            .AsNoTracking()
            .Where(ch => eLearningTrainingIds.Contains(ch.TrainingId))
            .GroupBy(ch => ch.TrainingId)
            .Select(g => new { TrainingId = g.Key, Chapters = g.Count() })
            .ToListAsync(cancellationToken);

        var minutesMap = minutesByTraining.ToDictionary(x => x.TrainingId, x => x.Minutes);
        var chaptersMap = chaptersByTraining.ToDictionary(x => x.TrainingId, x => x.Chapters);

        var result = new Dictionary<Guid, double>(eLearningTrainingIds.Count);
        foreach (var trainingId in eLearningTrainingIds)
        {
            var minutes = minutesMap.GetValueOrDefault(trainingId, 0);
            var chapters = chaptersMap.GetValueOrDefault(trainingId, 0);
            result[trainingId] = minutes > 0
                ? Math.Round(minutes / 60.0, 2)
                : Math.Round(chapters * FallbackHoursPerChapter, 2);
        }

        return result;
    }
}
