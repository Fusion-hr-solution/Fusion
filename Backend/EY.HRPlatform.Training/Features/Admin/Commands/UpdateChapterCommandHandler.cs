using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateChapterCommandHandler : ICommandHandler<UpdateChapterCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateChapterCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateChapterCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure(Error.Validation("Chapter.TitleRequired", "Chapter title is required."));

        if (request.OrderIndex < 0)
            return Result.Failure(Error.Validation("Chapter.InvalidOrderIndex", "Order index must be zero or greater."));

        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(c => c.Id == request.ChapterId && c.TrainingId == request.TrainingId,
                cancellationToken);

        if (chapter is null)
            return Result.Failure(Error.NotFound("Chapter", request.ChapterId));

        var duplicateIndex = await _db.Chapters
            .AnyAsync(c => c.TrainingId == request.TrainingId && c.OrderIndex == request.OrderIndex && c.Id != request.ChapterId, cancellationToken);

        if (duplicateIndex)
            return Result.Failure(Error.Conflict("Chapter.DuplicateOrderIndex",
                $"A chapter with order index {request.OrderIndex} already exists in this training. Please choose a different index."));

        if (!Enum.TryParse<ContentType>(request.ContentType, true, out var contentType))
            return Result.Failure(Error.Validation("Chapter.InvalidContentType",
                $"Invalid content type '{request.ContentType}'. Valid values: Video, Pdf, Article, Exercise."));

        chapter.Update(
            request.Title,
            contentType,
            request.ContentUri,
            request.OrderIndex,
            request.TextContent,
            request.VideoUrl,
            request.EstimatedDurationMinutes);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
