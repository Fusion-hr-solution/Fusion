using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class ReorderChaptersCommandHandler : ICommandHandler<ReorderChaptersCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderChaptersCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderChaptersCommand request, CancellationToken cancellationToken)
    {
        if (request.ChapterIds.Count == 0)
            return Result.Failure(Error.Validation("Chapter.EmptyReorderList", "Chapter list cannot be empty."));

        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure(Error.NotFound("Training", request.TrainingId));

        var chapters = await _db.Chapters
            .Where(c => c.TrainingId == request.TrainingId)
            .ToListAsync(cancellationToken);

        if (chapters.Count != request.ChapterIds.Count)
            return Result.Failure(Error.Validation("Chapter.CountMismatch",
                $"Expected {chapters.Count} chapter IDs but received {request.ChapterIds.Count}."));

        var chapterMap = chapters.ToDictionary(c => c.Id);

        for (var i = 0; i < request.ChapterIds.Count; i++)
        {
            var chapterId = request.ChapterIds[i];

            if (!chapterMap.TryGetValue(chapterId, out var chapter))
                return Result.Failure(Error.Validation("Chapter.InvalidId",
                    $"Chapter '{chapterId}' does not belong to this training."));

            chapter.Update(chapter.Title, chapter.ContentType, chapter.ContentUri, i,
                chapter.TextContent, chapter.VideoUrl, chapter.EstimatedDurationMinutes);
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
