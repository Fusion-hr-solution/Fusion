using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Internal.Queries;

public class GetTrainingContentForInternalQueryHandler
    : IQueryHandler<GetTrainingContentForInternalQuery, Result<InternalTrainingContentDto>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingContentForInternalQueryHandler(TrainingDbContext db)
    {
        _db = db;
    }

    public async Task<Result<InternalTrainingContentDto>> Handle(
        GetTrainingContentForInternalQuery request,
        CancellationToken cancellationToken)
    {
        // Root at Trainings so the !IsDeleted global query filter applies (it does NOT
        // cascade to Chapters/ContentBlocks). Project nested collections (no Include) to
        // avoid a cartesian blow-up; order both levels explicitly by OrderIndex.
        var training = await _db.Trainings
            .AsNoTracking()
            .Where(t => t.Id == request.TrainingId)
            .Select(t => new
            {
                t.Id,
                t.Title,
                Chapters = t.Chapters
                    .OrderBy(c => c.OrderIndex)
                    .Select(c => new
                    {
                        c.Id,
                        c.Title,
                        c.OrderIndex,
                        Blocks = c.ContentBlocks
                            .OrderBy(b => b.OrderIndex)
                            .Select(b => new
                            {
                                b.Id,
                                b.Type,
                                b.OrderIndex,
                                b.Title,
                                b.TextContent,
                                b.ContentUri
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (training is null)
            return Result.Failure<InternalTrainingContentDto>(
                new Error("Training.NotFound", $"Training with id '{request.TrainingId}' was not found."));

        // Materialised — map enum -> string in memory (avoids translating Type.ToString() to SQL).
        var dto = new InternalTrainingContentDto
        {
            TrainingId = training.Id,
            TrainingTitle = training.Title,
            Chapters = training.Chapters
                .Select(c => new InternalChapterContentDto
                {
                    Id = c.Id,
                    Title = c.Title,
                    OrderIndex = c.OrderIndex,
                    Blocks = c.Blocks
                        .Select(b => new InternalContentBlockDto
                        {
                            Id = b.Id,
                            Type = b.Type.ToString(),
                            OrderIndex = b.OrderIndex,
                            Title = b.Title,
                            TextContent = b.TextContent,
                            ContentUri = b.ContentUri
                        })
                        .ToList()
                })
                .ToList()
        };

        return Result.Success(dto);
    }
}
