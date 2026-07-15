using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Content;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateContentBlockCommandHandler : ICommandHandler<UpdateContentBlockCommand, Result>
{
    private readonly TrainingDbContext _db;
    private readonly IPdfTextExtractor _pdf;

    public UpdateContentBlockCommandHandler(TrainingDbContext db, IPdfTextExtractor pdf)
    {
        _db = db;
        _pdf = pdf;
    }

    public async Task<Result> Handle(UpdateContentBlockCommand request, CancellationToken cancellationToken)
    {
        var block = await _db.ContentBlocks
            .Include(b => b.Chapter)
            .FirstOrDefaultAsync(b => b.Id == request.ContentBlockId
                                   && b.ChapterId == request.ChapterId
                                   && b.Chapter.TrainingId == request.TrainingId,
                cancellationToken);

        if (block is null)
            return Result.Failure(Error.NotFound("ContentBlock", request.ContentBlockId));

        if (!Enum.TryParse<ContentType>(request.Type, true, out var contentType))
            return Result.Failure(Error.Validation("ContentBlock.InvalidType",
                $"Invalid content type '{request.Type}'. Valid values: Video, Pdf, Article, Exercise."));

        block.Update(
            contentType,
            request.Title,
            _pdf.ResolveTextContent(contentType, request.TextContent, request.ContentUri),
            request.ContentUri,
            request.VideoUrl,
            request.EstimatedDurationMinutes);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
