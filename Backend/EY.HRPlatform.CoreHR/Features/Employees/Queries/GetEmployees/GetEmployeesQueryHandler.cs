using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Models.Responses;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;

public sealed class GetEmployeesQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeDetailsReadModelService employeeDetailsReadModelService,
    IWorkforceAccountStatusReader workforceAccountStatusReader) : IQueryHandler<GetEmployeesQuery, Result<PagedResponse<EmployeeListItemDto>>>
{
    private const int MaxPageSize = 100;

    public async Task<Result<PagedResponse<EmployeeListItemDto>>> Handle(
        GetEmployeesQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        var employeeQuery = dbContext.Employees
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchTerm = request.Search.Trim().ToLowerInvariant();
            employeeQuery = employeeQuery.Where(e =>
                e.FirstName.ToLower().Contains(searchTerm) ||
                e.LastName.ToLower().Contains(searchTerm) ||
                (e.Email != null && e.Email.ToLower().Contains(searchTerm)) ||
                e.EmployeeNumber.ToLower().Contains(searchTerm) ||
                (e.FirstName + " " + e.LastName).ToLower().Contains(searchTerm));
        }

        var employees = await employeeQuery.ToListAsync(cancellationToken);
        var items = new List<EmployeeListItemDto>(employees.Count);

        foreach (var employee in employees)
        {
            items.Add(await employeeDetailsReadModelService.BuildListItemAsync(
                employee,
                EmployeeReadAudience.HrAdmin,
                null,
                cancellationToken));
        }

        if (!string.IsNullOrWhiteSpace(request.OrgUnitCode))
        {
            var normalizedCode = request.OrgUnitCode.Trim().ToUpperInvariant();
            var orgUnitId = await dbContext.OrgUnits
                .AsNoTracking()
                .Where(x => x.Code == normalizedCode)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            items = items
                .Where(item => item.OrgUnitId == orgUnitId)
                .ToList();
        }

        if (request.OrgUnitId.HasValue)
        {
            items = items
                .Where(item => item.OrgUnitId == request.OrgUnitId.Value)
                .ToList();
        }

        if (request.ManagerId.HasValue)
        {
            items = items
                .Where(item => item.ManagerId == request.ManagerId.Value)
                .ToList();
        }

        if (request.Status.HasValue)
        {
            items = items
                .Where(item => item.Status == request.Status.Value)
                .ToList();
        }

        if (request.Readiness.HasValue)
        {
            items = ApplyReadinessFilter(items, request.Readiness.Value).ToList();
        }

        if (request.Access.HasValue)
        {
            var statuses = await workforceAccountStatusReader.GetStatusesAsync(
                items.Where(employee => !string.IsNullOrWhiteSpace(employee.Email)).Select(employee => new WorkforceAccountSubjectDto(
                    employee.Id,
                    employee.Email!,
                    employee.FirstName,
                    employee.LastName)).ToList(),
                cancellationToken);

            items = items
                .Where(employee => MatchesAccessFilter(statuses.GetValueOrDefault(employee.Id), request.Access.Value))
                .ToList();
        }

        items = ApplySorting(items, request.SortBy, request.SortDir).ToList();

        var totalCount = items.Count;
        var pagedItems = items
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Result.Success(new PagedResponse<EmployeeListItemDto>
        {
            Items = pagedItems,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    private static IEnumerable<EmployeeListItemDto> ApplySorting(
        IEnumerable<EmployeeListItemDto> items,
        EmployeeSortField sortBy,
        SortDirection sortDir)
    {
        return (sortBy, sortDir) switch
        {
            (EmployeeSortField.Name, SortDirection.Asc) =>
                items.OrderBy(e => e.LastName).ThenBy(e => e.FirstName),
            (EmployeeSortField.Name, SortDirection.Desc) =>
                items.OrderByDescending(e => e.LastName).ThenByDescending(e => e.FirstName),
            (EmployeeSortField.Email, SortDirection.Asc) =>
                items.OrderBy(e => e.Email),
            (EmployeeSortField.Email, SortDirection.Desc) =>
                items.OrderByDescending(e => e.Email),
            (EmployeeSortField.HireDate, SortDirection.Asc) =>
                items.OrderBy(e => e.HireDate),
            (EmployeeSortField.HireDate, SortDirection.Desc) =>
                items.OrderByDescending(e => e.HireDate),
            (EmployeeSortField.Status, SortDirection.Asc) =>
                items.OrderBy(e => e.Status),
            (EmployeeSortField.Status, SortDirection.Desc) =>
                items.OrderByDescending(e => e.Status),
            _ => items.OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
        };
    }

    private static IEnumerable<EmployeeListItemDto> ApplyReadinessFilter(
        IEnumerable<EmployeeListItemDto> items,
        EmployeeReadinessFilter readiness)
    {
        return readiness switch
        {
            EmployeeReadinessFilter.Ready => items.Where(employee => employee.Readiness.EmployeeStateIssueCount == 0),
            EmployeeReadinessFilter.NeedsAttention => items.Where(employee => employee.Readiness.EmployeeStateIssueCount > 0),
            EmployeeReadinessFilter.MissingRequiredField => items.Where(employee =>
                employee.Readiness.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.MissingRequiredField)),
            EmployeeReadinessFilter.MissingOrgUnit => items.Where(employee =>
                employee.Readiness.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.MissingOrgUnit)),
            EmployeeReadinessFilter.ReportingIssue => items.Where(employee =>
                employee.Readiness.EmployeeStateIssues.Any(issue => issue.Code is EmployeeReadinessIssueCodes.ManagerInactive or EmployeeReadinessIssueCodes.ManagerMissing)),
            EmployeeReadinessFilter.NoManagerAssigned => items.Where(employee =>
                employee.Readiness.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.NoManagerAssigned)),
            EmployeeReadinessFilter.ManagerInactive => items.Where(employee =>
                employee.Readiness.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.ManagerInactive)),
            EmployeeReadinessFilter.ManagerMissing => items.Where(employee =>
                employee.Readiness.EmployeeStateIssues.Any(issue => issue.Code == EmployeeReadinessIssueCodes.ManagerMissing)),
            EmployeeReadinessFilter.DeactivationBlocked => items.Where(employee => employee.Readiness.BlockingIssueCount > 0),
            _ => items
        };
    }

    private static bool MatchesAccessFilter(WorkforceAccountStatusDto? account, EmployeeAccessFilter access)
    {
        return access switch
        {
            EmployeeAccessFilter.NotInvited => account is null || account.ProvisioningState == "Unprovisioned",
            EmployeeAccessFilter.Invited => account?.ProvisioningState == "InvitePending",
            EmployeeAccessFilter.AccountActive => account?.ProvisioningState == "Active",
            EmployeeAccessFilter.NeedsReview => account is not null && account.ProvisioningState is "InviteAccepted" or "InviteExpired" or "InviteRevoked" or "Inactive" or "Conflict",
            _ => false
        };
    }
}
