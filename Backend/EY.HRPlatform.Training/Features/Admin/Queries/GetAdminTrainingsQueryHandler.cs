using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetAdminTrainingsQueryHandler : IQueryHandler<GetAdminTrainingsQuery, Result<PagedResponse<AdminTrainingDto>>>
{
    private readonly TrainingDbContext _db;

    public GetAdminTrainingsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<PagedResponse<AdminTrainingDto>>> Handle(
        GetAdminTrainingsQuery request, CancellationToken cancellationToken)
    {
        var query = request.IncludeDeleted
            ? _db.Trainings.AsNoTracking().IgnoreQueryFilters()
            : _db.Trainings.AsNoTracking();

        if (request.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == request.CategoryId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(t => t.Title.ToLower().Contains(search)
                                     || (t.Description != null && t.Description.ToLower().Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var trainings = await query
            .Include(t => t.Category)
            .Include(t => t.Chapters)
            .Include(t => t.OnSiteCourses)
            .Include(t => t.Assignments)
            .OrderByDescending(t => t.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(t => new AdminTrainingDto
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
                EnrollmentCount = t.Assignments.Count,
                TrainingType = t.TrainingType.ToString(),
                CostType = t.CostType.ToString(),
                SponsoringServiceLineId = t.SponsoringServiceLineId,
                ScheduledDate = t.ScheduledDate,
                IsDeleted = t.IsDeleted,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResponse<AdminTrainingDto>
        {
            Items = trainings,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize
        });
    }
}
