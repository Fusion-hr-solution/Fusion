using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;

public sealed class GetEmployeesQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetEmployeesQuery, Result<PagedResponse<EmployeeListItemDto>>>
{
    private const int MaxPageSize = 100;

    public async Task<Result<PagedResponse<EmployeeListItemDto>>> Handle(
        GetEmployeesQuery request,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Manager)
            .AsQueryable();

        // Apply search filter (case-insensitive via ToLower)
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchTerm = request.Search.Trim().ToLower();
            query = query.Where(e =>
                e.FirstName.ToLower().Contains(searchTerm) ||
                e.LastName.ToLower().Contains(searchTerm) ||
                e.Email.ToLower().Contains(searchTerm) ||
                (e.FirstName + " " + e.LastName).ToLower().Contains(searchTerm));
        }

        // Apply department filter (case-insensitive)
        if (!string.IsNullOrWhiteSpace(request.Department))
        {
            var department = request.Department.Trim().ToLower();
            query = query.Where(e => e.Department != null &&
                e.Department.ToLower() == department);
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
            .Select(e => new EmployeeListItemDto(
                e.Id,
                e.FirstName,
                e.LastName,
                e.Email,
                e.Department,
                e.JobTitle,
                e.Status,
                e.HireDate,
                e.ManagerId,
                e.Manager != null ? e.Manager.FirstName + " " + e.Manager.LastName : null))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResponse<EmployeeListItemDto>
        {
            Items = employees,
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
            (EmployeeSortField.Department, SortDirection.Asc) =>
                query.OrderBy(e => e.Department),
            (EmployeeSortField.Department, SortDirection.Desc) =>
                query.OrderByDescending(e => e.Department),
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
}
