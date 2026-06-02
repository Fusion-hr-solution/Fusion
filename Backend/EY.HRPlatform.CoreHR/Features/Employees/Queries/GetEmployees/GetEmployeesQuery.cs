using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;

/// <summary>
/// Query for retrieving a paginated, searchable, filterable list of employees.
/// </summary>
public record GetEmployeesQuery(
    string? Search = null,
    EmployeeStatus? Status = null,
    EmployeeReadinessFilter? Readiness = null,
    EmployeeSortField SortBy = EmployeeSortField.Name,
    SortDirection SortDir = SortDirection.Asc,
    int Page = 1,
    int PageSize = 20
) : IQuery<Result<PagedResponse<EmployeeListItemDto>>>;
