using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Catalog.Queries;

public class GetCategoriesQueryHandler : IQueryHandler<GetCategoriesQuery, Result<List<TrainingCategoryDto>>>
{
    private readonly TrainingDbContext _db;

    public GetCategoriesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainingCategoryDto>>> Handle(GetCategoriesQuery request, CancellationToken cancellationToken)
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .Include(c => c.Trainings)
            .OrderBy(c => c.Name)
            .Select(c => new TrainingCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                TrainingCount = c.Trainings.Count
            })
            .ToListAsync(cancellationToken);

        return Result.Success(categories);
    }
}
