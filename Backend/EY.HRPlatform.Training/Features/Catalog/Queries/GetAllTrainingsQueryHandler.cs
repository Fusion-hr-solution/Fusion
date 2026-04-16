using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Catalog.Queries;

public class GetAllTrainingsQueryHandler : IQueryHandler<GetAllTrainingsQuery, Result<PagedResponse<TrainingDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAllTrainingsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<PagedResponse<TrainingDto>>> Handle(GetAllTrainingsQuery request, CancellationToken cancellationToken)
    {
        var query = _db.Trainings
            .AsNoTracking()
            .Include(t => t.Category)
            .Include(t => t.Chapters)
            .Include(t => t.OnSiteCourses)
            .AsQueryable();

        if (request.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == request.CategoryId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(t =>
                t.Title.Contains(request.Search) ||
                (t.Description != null && t.Description.Contains(request.Search)));

        var totalCount = await query.CountAsync(cancellationToken);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var trainings = await query
            .OrderBy(t => t.Title)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                ChapterCount = t.TrainingType == TrainingType.OnSite ? t.OnSiteCourses.Count : t.Chapters.Count,
                TrainingType = t.TrainingType.ToString(),
                ScheduledDate = t.ScheduledDate,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResponse<TrainingDto>
        {
            Items = trainings,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }
}
