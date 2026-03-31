using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnits;

public sealed class GetOrgUnitsQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetOrgUnitsQuery, Result<PagedResponse<OrgUnitListItemDto>>>
{
    private const int MaxPageSize = 100;

    public async Task<Result<PagedResponse<OrgUnitListItemDto>>> Handle(
        GetOrgUnitsQuery request,
        CancellationToken cancellationToken)
    {
        var query = dbContext.OrgUnits
            .AsNoTracking()
            .Include(o => o.Parent)
            .AsQueryable();

        // Apply search filter (case-insensitive)
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchTerm = request.Search.Trim().ToLowerInvariant();
            query = query.Where(o =>
                o.Code.ToLower().Contains(searchTerm) ||
                o.Name.ToLower().Contains(searchTerm));
        }

        // Apply type filter (case-insensitive)
        if (!string.IsNullOrWhiteSpace(request.Type))
        {
            var type = request.Type.Trim().ToLowerInvariant();
            query = query.Where(o => o.Type.ToLower() == type);
        }

        // Apply parent filter (null = roots only when explicitly set)
        if (request.ParentId.HasValue)
        {
            query = query.Where(o => o.ParentId == request.ParentId.Value);
        }

        // Apply active status filter
        if (request.IsActive.HasValue)
        {
            query = query.Where(o => o.IsActive == request.IsActive.Value);
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply sorting
        query = ApplySorting(query, request.SortBy, request.SortDir);

        // Validate and clamp pagination parameters
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        // Apply pagination and project to DTO
        var orgUnits = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrgUnitListItemDto(
                o.Id,
                o.Code,
                o.Name,
                o.Type,
                o.ParentId,
                o.Parent != null ? o.Parent.Name : null,
                o.IsActive))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResponse<OrgUnitListItemDto>
        {
            Items = orgUnits,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    private static IQueryable<OrgUnit> ApplySorting(
        IQueryable<OrgUnit> query,
        OrgUnitSortField sortBy,
        SortDirection sortDir)
    {
        return (sortBy, sortDir) switch
        {
            (OrgUnitSortField.Code, SortDirection.Asc) =>
                query.OrderBy(o => o.Code),
            (OrgUnitSortField.Code, SortDirection.Desc) =>
                query.OrderByDescending(o => o.Code),
            (OrgUnitSortField.Name, SortDirection.Asc) =>
                query.OrderBy(o => o.Name),
            (OrgUnitSortField.Name, SortDirection.Desc) =>
                query.OrderByDescending(o => o.Name),
            (OrgUnitSortField.Type, SortDirection.Asc) =>
                query.OrderBy(o => o.Type).ThenBy(o => o.Name),
            (OrgUnitSortField.Type, SortDirection.Desc) =>
                query.OrderByDescending(o => o.Type).ThenByDescending(o => o.Name),
            _ => query.OrderBy(o => o.Name)
        };
    }
}
