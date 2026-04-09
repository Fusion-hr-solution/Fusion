using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class AddContentBlockCommandHandler : ICommandHandler<AddContentBlockCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AddContentBlockCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AddContentBlockCommand request, CancellationToken cancellationToken)
    {
        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(c => c.Id == request.ChapterId && c.TrainingId == request.TrainingId,
                cancellationToken);

        if (chapter is null)
            return Result.Failure<Guid>(Error.NotFound("Chapter", request.ChapterId));

        if (!Enum.TryParse<ContentType>(request.Type, true, out var contentType))
            return Result.Failure<Guid>(Error.Validation("ContentBlock.InvalidType",
                $"Invalid content type '{request.Type}'. Valid values: Video, Pdf, Article, Exercise."));

        // Auto-assign order index to the end of the list
        var maxIndex = await _db.ContentBlocks
            .Where(b => b.ChapterId == request.ChapterId)
            .MaxAsync(b => (int?)b.OrderIndex, cancellationToken) ?? -1;

        var block = new ContentBlock(
            contentType,
            maxIndex + 1,
            request.ChapterId,
            request.Title,
            request.TextContent,
            request.ContentUri,
            request.VideoUrl,
            request.EstimatedDurationMinutes);

        _db.ContentBlocks.Add(block);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(block.Id);
    }
}
