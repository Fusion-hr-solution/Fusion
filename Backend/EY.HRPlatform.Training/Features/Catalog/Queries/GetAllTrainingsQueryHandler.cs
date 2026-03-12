using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Catalog.Queries;

public class GetAllTrainingsQueryHandler : IQueryHandler<GetAllTrainingsQuery, Result<List<TrainingDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAllTrainingsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainingDto>>> Handle(GetAllTrainingsQuery request, CancellationToken cancellationToken)
    {
        var query = _db.Trainings
            .AsNoTracking()
            .Include(t => t.Category)
            .Include(t => t.Chapters)
            .AsQueryable();

        if (request.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == request.CategoryId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(t =>
                t.Title.Contains(request.Search) ||
                (t.Description != null && t.Description.Contains(request.Search)));

        var trainings = await query
            .OrderBy(t => t.Title)
            .Select(t => new TrainingDto
            {
                Id = t.Id,
                Title = t.Title,
                Description = t.Description,
                Credits = t.Credits,
                IsMandatory = t.IsMandatory,
                BadgeLevel = t.BadgeLevel.ToString(),
                Duration = t.Duration,
                CategoryId = t.CategoryId,
                CategoryName = t.Category.Name,
                ChapterCount = t.Chapters.Count,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result.Success(trainings);
    }
}
