using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;

public sealed record GetObjectiveTemplatesQuery(
    string? Search,
    string? Status,
    string? Category,
    int Page,
    int PageSize) : IQuery<PagedResponse<ObjectiveTemplateDto>>;

public sealed class GetObjectiveTemplatesQueryHandler(
    PerformanceDbContext dbContext) : IQueryHandler<GetObjectiveTemplatesQuery, PagedResponse<ObjectiveTemplateDto>>
{
    private const int MaxPageSize = 100;

    public async Task<PagedResponse<ObjectiveTemplateDto>> Handle(
        GetObjectiveTemplatesQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var query = dbContext.ObjectiveTemplates.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLowerInvariant();
            query = query.Where(t =>
                t.Name.ToLower().Contains(term) ||
                (t.Category != null && t.Category.ToLower().Contains(term)));
        }

        if (Enum.TryParse<ObjectiveTemplateStatus>(request.Status, ignoreCase: true, out var status))
        {
            query = query.Where(t => t.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            var category = request.Category.Trim();
            query = query.Where(t => t.Category == category);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var templates = await query
            .OrderBy(t => t.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResponse<ObjectiveTemplateDto>
        {
            Items = templates.Select(ObjectiveTemplateMapper.ToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }
}
