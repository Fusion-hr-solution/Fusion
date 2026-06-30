using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;

public sealed record GetTemplateLibraryQuery(
    string? Search = null,
    string? Status = null,
    Guid? CategoryId = null,
    string? MeasurementType = null,
    int Page = 1,
    int PageSize = 20) : IQuery<Result<PagedResponse<TemplateDto>>>;

public sealed class GetTemplateLibraryQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetTemplateLibraryQuery, Result<PagedResponse<TemplateDto>>>
{
    public async Task<Result<PagedResponse<TemplateDto>>> Handle(
        GetTemplateLibraryQuery query,
        CancellationToken cancellationToken)
    {
        var q = db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .AsNoTracking()
            .AsQueryable();

        // Status filter
        if (!string.IsNullOrWhiteSpace(query.Status)
            && Enum.TryParse<ObjectiveTemplateStatus>(query.Status, ignoreCase: true, out var statusEnum))
        {
            q = q.Where(t => t.Status == statusEnum);
        }

        // Load and apply remaining filters in-memory (search/category/measurement across revisions)
        var all = await q
            .OrderBy(t => t.Status == ObjectiveTemplateStatus.Active ? 0 : t.Status == ObjectiveTemplateStatus.Draft ? 1 : 2)
            .ThenByDescending(t => t.UpdatedAt ?? t.CreatedAt)
            .ToListAsync(cancellationToken);

        // Search: title, description, tags on the active or draft revision
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            all = all.Where(t =>
            {
                var rev = t.ActiveRevision ?? t.DraftRevision;
                if (rev is null) return false;
                return (rev.Title.ToLowerInvariant().Contains(term))
                    || (rev.Description?.ToLowerInvariant().Contains(term) == true)
                    || (rev.Tags?.ToLowerInvariant().Contains(term) == true);
            }).ToList();
        }

        // Category filter
        if (query.CategoryId.HasValue)
        {
            all = all.Where(t =>
            {
                var rev = t.ActiveRevision ?? t.DraftRevision;
                return rev?.CategoryId == query.CategoryId.Value;
            }).ToList();
        }

        // MeasurementType filter
        if (!string.IsNullOrWhiteSpace(query.MeasurementType))
        {
            var mt = query.MeasurementType.Trim();
            all = all.Where(t =>
            {
                var rev = t.ActiveRevision ?? t.DraftRevision;
                return string.Equals(rev?.MeasurementType, mt, StringComparison.OrdinalIgnoreCase);
            }).ToList();
        }

        var totalCount = all.Count;
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = all
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(TemplateMapper.ToTemplateDto)
            .ToList();

        return Result.Success(new PagedResponse<TemplateDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }
}
