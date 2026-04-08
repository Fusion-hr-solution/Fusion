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

        var distinctCount = request.ChapterIds.Distinct().Count();
        if (distinctCount != request.ChapterIds.Count)
            return Result.Failure(Error.Validation("Chapter.DuplicateIds",
                "Chapter IDs must be unique — duplicates are not allowed."));

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

        // Validate all IDs first, before modifying any entity
        for (var i = 0; i < request.ChapterIds.Count; i++)
        {
            if (!chapterMap.ContainsKey(request.ChapterIds[i]))
                return Result.Failure(Error.Validation("Chapter.InvalidId",
                    $"Chapter '{request.ChapterIds[i]}' does not belong to this training."));
        }

        // Two-pass save to avoid EF circular dependency caused by the unique (TrainingId, OrderIndex)
        // index (e.g. swapping 0↔1 creates a cycle EF cannot resolve in a single SaveChanges).
        // Pass 1: set all chapters to temporary negative indices (unique, no constraint conflicts).
        for (var i = 0; i < chapters.Count; i++)
            chapters[i].Reorder(-(i + 1));
        await _db.SaveChangesAsync(cancellationToken);

        // Pass 2: set the final target indices (transitions from negative → non-negative, no conflicts).
        for (var i = 0; i < request.ChapterIds.Count; i++)
            chapterMap[request.ChapterIds[i]].Reorder(i);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
