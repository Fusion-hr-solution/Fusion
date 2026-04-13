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

        if (!Enum.TryParse<ChapterLayout>(request.Layout, true, out var layout))
            return Result.Failure(Error.Validation("Chapter.InvalidLayout",
                $"Invalid layout '{request.Layout}'. Valid values: SingleContent, SplitLayout, MultiSection."));

        chapter.Update(request.Title, layout);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
