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

        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        if (!Enum.TryParse<ContentType>(request.ContentType, true, out var contentType))
            return Result.Failure<Guid>(Error.Validation("Chapter.InvalidContentType",
                $"Invalid content type '{request.ContentType}'. Valid values: Video, Pdf, Article, Exercise."));

        // Auto-assign order index to the end of the list to avoid unique-index conflicts.
        var maxIndex = await _db.Chapters
            .Where(c => c.TrainingId == request.TrainingId)
            .MaxAsync(c => (int?)c.OrderIndex, cancellationToken) ?? -1;

        var chapter = new TrainingChapter(
            request.Title,
            contentType,
            request.ContentUri,
            maxIndex + 1,
            request.TrainingId,
            request.TextContent,
            request.VideoUrl,
            request.EstimatedDurationMinutes);

        _db.Chapters.Add(chapter);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(chapter.Id);
    }
}
