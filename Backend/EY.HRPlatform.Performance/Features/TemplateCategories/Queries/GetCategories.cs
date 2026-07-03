using EY.HRPlatform.Performance.Features.TemplateCategories.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TemplateCategories.Queries;

public sealed record GetCategoriesQuery(bool IncludeArchived = false) : IQuery<Result<IReadOnlyList<CategoryDto>>>;

public sealed class GetCategoriesQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetCategoriesQuery, Result<IReadOnlyList<CategoryDto>>>
{
    public async Task<Result<IReadOnlyList<CategoryDto>>> Handle(
        GetCategoriesQuery request,
        CancellationToken cancellationToken)
    {
        var query = db.ObjectiveTemplateCategories.AsQueryable();

        if (!request.IncludeArchived)
            query = query.Where(c => c.Status == Domain.Entities.CategoryStatus.Active);

        var categories = await query
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Code, c.Name, c.Description, c.Status.ToString()))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<CategoryDto>>(categories);
    }
}
