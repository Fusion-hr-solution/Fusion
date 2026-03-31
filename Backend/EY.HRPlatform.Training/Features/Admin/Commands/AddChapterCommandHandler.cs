using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class AddChapterCommandHandler : ICommandHandler<AddChapterCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AddChapterCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AddChapterCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure<Guid>(Error.Validation("Chapter.TitleRequired", "Chapter title is required."));

        if (request.OrderIndex < 0)
            return Result.Failure<Guid>(Error.Validation("Chapter.InvalidOrderIndex", "Order index must be zero or greater."));

        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        var duplicateIndex = await _db.Chapters
            .AnyAsync(c => c.TrainingId == request.TrainingId && c.OrderIndex == request.OrderIndex, cancellationToken);

        if (duplicateIndex)
            return Result.Failure<Guid>(Error.Conflict("Chapter.DuplicateOrderIndex",
                $"A chapter with order index {request.OrderIndex} already exists in this training. Please choose a different index."));

        if (!Enum.TryParse<ContentType>(request.ContentType, true, out var contentType))
            return Result.Failure<Guid>(Error.Validation("Chapter.InvalidContentType",
                $"Invalid content type '{request.ContentType}'. Valid values: Video, Pdf, Article, Exercise."));

        var chapter = new TrainingChapter(
            request.Title,
            contentType,
            request.ContentUri,
            request.OrderIndex,
            request.TrainingId,
            request.TextContent,
            request.VideoUrl,
            request.EstimatedDurationMinutes);

        _db.Chapters.Add(chapter);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(chapter.Id);
    }
}
