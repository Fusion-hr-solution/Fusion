using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Import;

/// <summary>US-8.2.4 — build the pre-formatted training import template, seeded with current categories.</summary>
public record GenerateTrainingImportTemplateQuery : IQuery<Result<byte[]>>;

public class GenerateTrainingImportTemplateQueryHandler
    : IQueryHandler<GenerateTrainingImportTemplateQuery, Result<byte[]>>
{
    private readonly TrainingDbContext _db;
    private readonly ITrainingImportTemplateGenerator _generator;

    public GenerateTrainingImportTemplateQueryHandler(
        TrainingDbContext db, ITrainingImportTemplateGenerator generator)
    {
        _db = db;
        _generator = generator;
    }

    public async Task<Result<byte[]>> Handle(
        GenerateTrainingImportTemplateQuery request, CancellationToken cancellationToken)
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync(cancellationToken);

        return Result.Success(_generator.Generate(categories));
    }
}
