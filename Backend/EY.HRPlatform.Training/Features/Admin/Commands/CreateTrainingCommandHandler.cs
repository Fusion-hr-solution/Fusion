using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class CreateTrainingCommandHandler : ICommandHandler<CreateTrainingCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateTrainingCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateTrainingCommand request, CancellationToken cancellationToken)
    {
        var categoryExists = await _db.Categories
            .AnyAsync(c => c.Id == request.CategoryId, cancellationToken);

        if (!categoryExists)
            return Result.Failure<Guid>(Error.NotFound("Category", request.CategoryId));

        if (!Enum.TryParse<BadgeLevel>(request.BadgeLevel, true, out var badgeLevel))
            return Result.Failure<Guid>(Error.Validation("Training.InvalidBadgeLevel",
                $"Invalid badge level '{request.BadgeLevel}'. Valid values: Bronze, Silver, Gold."));

        var training = new TrainingCourse(
            request.Title,
            request.Description,
            request.Credits,
            request.IsMandatory,
            badgeLevel,
            request.CategoryId,
            request.Duration);

        foreach (var ch in request.Chapters)
        {
            if (!Enum.TryParse<ChapterLayout>(ch.Layout, true, out var layout))
                return Result.Failure<Guid>(Error.Validation("Chapter.InvalidLayout",
                    $"Invalid layout '{ch.Layout}'. Valid values: SingleContent, SplitLayout, MultiSection."));

            var chapter = new TrainingChapter(
                ch.Title,
                layout,
                ch.OrderIndex,
                training.Id);

            foreach (var block in ch.ContentBlocks)
            {
                if (!Enum.TryParse<ContentType>(block.Type, true, out var contentType))
                    return Result.Failure<Guid>(Error.Validation("ContentBlock.InvalidType",
                        $"Invalid content type '{block.Type}'. Valid values: Video, Pdf, Article, Exercise."));

                chapter.AddContentBlock(new ContentBlock(
                    contentType,
                    block.OrderIndex,
                    chapter.Id,
                    block.Title,
                    block.TextContent,
                    block.ContentUri,
                    block.VideoUrl,
                    block.EstimatedDurationMinutes));
            }

            training.AddChapter(chapter);
        }

        _db.Trainings.Add(training);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(training.Id);
    }
}
