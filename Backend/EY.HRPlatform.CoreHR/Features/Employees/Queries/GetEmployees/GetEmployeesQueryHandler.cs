using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;

public sealed class GetEmployeesQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeReadModelPolicy? employeeReadModelPolicy = null) : IQueryHandler<GetEmployeesQuery, Result<PagedResponse<EmployeeListItemDto>>>
{
    private const int MaxPageSize = 100;
    private readonly IEmployeeReadModelPolicy employeeReadModelPolicy = employeeReadModelPolicy ?? new EmployeeReadModelPolicy();

    public async Task<Result<PagedResponse<EmployeeListItemDto>>> Handle(
        GetEmployeesQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await GetReadSettingsAsync(cancellationToken);
        var query = dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Manager)
            .Include(e => e.OrgUnit)
            .AsQueryable();

        // Apply search filter (case-insensitive via ToLower)
        // Note: Using ToLower() instead of EF.Functions.ILike() for in-memory test compatibility.
        // PostgreSQL translates this to lower(col) which is acceptable for moderate table sizes.
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchTerm = request.Search.Trim().ToLowerInvariant();
            query = query.Where(e =>
                e.FirstName.ToLower().Contains(searchTerm) ||
                e.LastName.ToLower().Contains(searchTerm) ||
                e.Email.ToLower().Contains(searchTerm) ||
                (e.FirstName + " " + e.LastName).ToLower().Contains(searchTerm));
        }

        // Apply status filter
        if (request.Status.HasValue)
        {
            query = query.Where(e => e.Status == request.Status.Value);
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply sorting
        query = ApplySorting(query, request.SortBy, request.SortDir);

        // Validate and clamp pagination parameters
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        // Apply pagination and project to DTO
        var employees = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = employees
            .Select(employee => employeeReadModelPolicy.MapListItem(employee, settings, EmployeeReadAudience.HrAdmin))
            .ToList();

        return Result.Success(new PagedResponse<EmployeeListItemDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    private static IQueryable<Employee> ApplySorting(
        IQueryable<Employee> query,
        EmployeeSortField sortBy,
        SortDirection sortDir)
    {
        return (sortBy, sortDir) switch
        {
            (EmployeeSortField.Name, SortDirection.Asc) =>
                query.OrderBy(e => e.LastName).ThenBy(e => e.FirstName),
            (EmployeeSortField.Name, SortDirection.Desc) =>
                query.OrderByDescending(e => e.LastName).ThenByDescending(e => e.FirstName),
            (EmployeeSortField.Email, SortDirection.Asc) =>
                query.OrderBy(e => e.Email),
            (EmployeeSortField.Email, SortDirection.Desc) =>
                query.OrderByDescending(e => e.Email),
            (EmployeeSortField.HireDate, SortDirection.Asc) =>
                query.OrderBy(e => e.HireDate),
            (EmployeeSortField.HireDate, SortDirection.Desc) =>
                query.OrderByDescending(e => e.HireDate),
            (EmployeeSortField.Status, SortDirection.Asc) =>
                query.OrderBy(e => e.Status),
            (EmployeeSortField.Status, SortDirection.Desc) =>
                query.OrderByDescending(e => e.Status),
            _ => query.OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
        };
    }

    private async Task<Features.TenantSettings.Dtos.TenantSettingsDto> GetReadSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);
    }
}
