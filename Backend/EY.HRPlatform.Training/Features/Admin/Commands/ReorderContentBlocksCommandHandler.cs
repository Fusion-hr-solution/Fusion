using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class ReorderContentBlocksCommandHandler : ICommandHandler<ReorderContentBlocksCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderContentBlocksCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderContentBlocksCommand request, CancellationToken cancellationToken)
    {
        if (request.ContentBlockIds.Count == 0)
            return Result.Failure(Error.Validation("ContentBlock.EmptyReorderList", "Content block list cannot be empty."));

        var distinctCount = request.ContentBlockIds.Distinct().Count();
        if (distinctCount != request.ContentBlockIds.Count)
            return Result.Failure(Error.Validation("ContentBlock.DuplicateIds",
                "Content block IDs must be unique — duplicates are not allowed."));

        var chapterExists = await _db.Chapters
            .AnyAsync(c => c.Id == request.ChapterId && c.TrainingId == request.TrainingId, cancellationToken);

        if (!chapterExists)
            return Result.Failure(Error.NotFound("Chapter", request.ChapterId));

        var blocks = await _db.ContentBlocks
            .Where(b => b.ChapterId == request.ChapterId)
            .ToListAsync(cancellationToken);

        if (blocks.Count != request.ContentBlockIds.Count)
            return Result.Failure(Error.Validation("ContentBlock.CountMismatch",
                $"Expected {blocks.Count} content block IDs but received {request.ContentBlockIds.Count}."));

        var blockMap = blocks.ToDictionary(b => b.Id);

        for (var i = 0; i < request.ContentBlockIds.Count; i++)
        {
            if (!blockMap.ContainsKey(request.ContentBlockIds[i]))
                return Result.Failure(Error.Validation("ContentBlock.InvalidId",
                    $"Content block '{request.ContentBlockIds[i]}' does not belong to this chapter."));
        }

        // Two-pass save to avoid unique (ChapterId, OrderIndex) constraint conflicts.
        for (var i = 0; i < blocks.Count; i++)
            blocks[i].Reorder(-(i + 1));
        await _db.SaveChangesAsync(cancellationToken);

        for (var i = 0; i < request.ContentBlockIds.Count; i++)
            blockMap[request.ContentBlockIds[i]].Reorder(i);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
