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

        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(c => c.Id == request.ChapterId && c.TrainingId == request.TrainingId,
                cancellationToken);

        if (chapter is null)
            return Result.Failure(Error.NotFound("Chapter", request.ChapterId));

        if (!Enum.TryParse<ContentType>(request.ContentType, true, out var contentType))
            return Result.Failure(Error.Validation("Chapter.InvalidContentType",
                $"Invalid content type '{request.ContentType}'. Valid values: Video, Pdf, Article, Exercise."));

        // Keep the existing order index — reordering is done via the dedicated reorder endpoint.
        chapter.Update(
            request.Title,
            contentType,
            request.ContentUri,
            chapter.OrderIndex,
            request.TextContent,
            request.VideoUrl,
            request.EstimatedDurationMinutes);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
