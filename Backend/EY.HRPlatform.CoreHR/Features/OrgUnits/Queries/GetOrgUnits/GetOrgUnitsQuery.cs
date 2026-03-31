using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnits;

/// <summary>
/// Query for retrieving a paginated, searchable, filterable list of org units.
/// </summary>
public record GetOrgUnitsQuery(
    string? Search = null,
    string? Type = null,
    Guid? ParentId = null,
    bool? IsActive = true,
    OrgUnitSortField SortBy = OrgUnitSortField.Name,
    SortDirection SortDir = SortDirection.Asc,
    int Page = 1,
    int PageSize = 20
) : IQuery<Result<PagedResponse<OrgUnitListItemDto>>>;

public enum OrgUnitSortField
{
    Code,
    Name,
    Type
}
