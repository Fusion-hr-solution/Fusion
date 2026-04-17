using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Exams;

/// <summary>Shared helper for determining when an employee can take the exam.</summary>
internal static class ExamEligibility
{
    public record Result(bool AllChaptersCompleted, int TotalChapters, int CompletedChapters);

    public static async Task<Result> EvaluateAsync(
        TrainingDbContext db,
        Guid employeeId,
        Guid trainingId,
        CancellationToken cancellationToken)
    {
        var chapterIds = await db.Chapters
            .AsNoTracking()
            .Where(c => c.TrainingId == trainingId)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        if (chapterIds.Count == 0)
            return new Result(false, 0, 0);

        var completed = await db.ChapterProgress
            .AsNoTracking()
            .CountAsync(cp => cp.EmployeeId == employeeId
                           && cp.Completed
                           && chapterIds.Contains(cp.ChapterId), cancellationToken);

        return new Result(completed >= chapterIds.Count, chapterIds.Count, completed);
    }
}
