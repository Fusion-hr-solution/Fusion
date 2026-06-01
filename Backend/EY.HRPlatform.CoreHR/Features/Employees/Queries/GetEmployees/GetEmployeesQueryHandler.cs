using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
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
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    ITenantSettingsReadService tenantSettingsReadService,
    IWorkforceAccountStatusReader workforceAccountStatusReader) : IQueryHandler<GetEmployeesQuery, Result<PagedResponse<EmployeeListItemDto>>>
{
    private const int MaxPageSize = 100;
    private readonly IEmployeeReadModelPolicy employeeReadModelPolicy = employeeReadModelPolicy;

    public async Task<Result<PagedResponse<EmployeeListItemDto>>> Handle(
        GetEmployeesQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
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
                (e.EmployeeNumber != null && e.EmployeeNumber.ToLower().Contains(searchTerm)) ||
                (e.FirstName + " " + e.LastName).ToLower().Contains(searchTerm));
        }

        // Apply status filter
        if (request.Status.HasValue)
        {
            query = query.Where(e => e.Status == request.Status.Value);
        }

        if (request.Readiness.HasValue)
        {
            query = ApplyReadinessFilter(query, request.Readiness.Value, settings);
        }

        if (request.OrgUnitId.HasValue)
        {
            query = query.Where(employee => employee.OrgUnitId == request.OrgUnitId.Value);
        }

        if (request.ManagerId.HasValue)
        {
            query = query.Where(employee => employee.ManagerId == request.ManagerId.Value);
        }

        // Apply sorting
        query = ApplySorting(query, request.SortBy, request.SortDir);

        // Validate and clamp pagination parameters
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);

        if (request.Access.HasValue)
        {
            var candidateEmployees = await query.ToListAsync(cancellationToken);
            var candidateStatuses = await workforceAccountStatusReader.GetStatusesAsync(
                candidateEmployees.Select(employee => new WorkforceAccountSubjectDto(
                    employee.Id,
                    employee.Email,
                    employee.FirstName,
                    employee.LastName)).ToList(),
                cancellationToken);

            var filteredEmployees = candidateEmployees
                .Where(employee => MatchesAccessFilter(
                    candidateStatuses.GetValueOrDefault(employee.Id),
                    request.Access.Value))
                .ToList();

            var filteredTotalCount = filteredEmployees.Count;
            var pagedEmployees = filteredEmployees
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var filteredPageEmployeeIds = pagedEmployees
                .Select(employee => employee.Id)
                .ToList();

            var filteredDirectReportCounts = filteredPageEmployeeIds.Count == 0
                ? new Dictionary<Guid, int>()
                : await dbContext.Employees
                    .AsNoTracking()
                    .Where(employee => employee.ManagerId.HasValue
                        && employee.Status == EmployeeStatus.Active
                        && filteredPageEmployeeIds.Contains(employee.ManagerId.Value))
                    .GroupBy(employee => employee.ManagerId!.Value)
                    .Select(group => new { ManagerId = group.Key, Count = group.Count() })
                    .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);

            var filteredItems = pagedEmployees
                .Select(employee => employeeReadModelPolicy
                    .MapListItem(
                        employee,
                        settings,
                        EmployeeReadAudience.HrAdmin,
                        filteredDirectReportCounts.GetValueOrDefault(employee.Id)))
                .ToList();

            return Result.Success(new PagedResponse<EmployeeListItemDto>
            {
                Items = filteredItems,
                TotalCount = filteredTotalCount,
                Page = page,
                PageSize = pageSize
            });
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply pagination and project to DTO
        var employees = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var pageEmployeeIds = employees
            .Select(employee => employee.Id)
            .ToList();

        var directReportCounts = pageEmployeeIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await dbContext.Employees
                .AsNoTracking()
                .Where(employee => employee.ManagerId.HasValue
                    && employee.Status == EmployeeStatus.Active
                    && pageEmployeeIds.Contains(employee.ManagerId.Value))
                .GroupBy(employee => employee.ManagerId!.Value)
                .Select(group => new { ManagerId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);

        var items = employees
            .Select(employee => employeeReadModelPolicy
                .MapListItem(
                    employee,
                    settings,
                    EmployeeReadAudience.HrAdmin,
                    directReportCounts.GetValueOrDefault(employee.Id)))
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

    private IQueryable<Employee> ApplyReadinessFilter(
        IQueryable<Employee> query,
        EmployeeReadinessFilter readiness,
        Features.TenantSettings.Dtos.TenantSettingsDto settings)
    {
        var requiresJobTitle = settings.EmployeeFieldConfig.TryGetValue("jobTitle", out var jobTitleField)
            && jobTitleField.Required;

        return readiness switch
        {
            EmployeeReadinessFilter.Ready => query.Where(employee =>
                !(requiresJobTitle && (employee.JobTitle == null || employee.JobTitle == string.Empty))
                && employee.OrgUnitId != null
                && (!employee.ManagerId.HasValue || employee.Manager != null)
                && (!employee.ManagerId.HasValue || employee.Manager == null || employee.Manager.Status == Domain.Enums.EmployeeStatus.Active)),
            EmployeeReadinessFilter.NeedsAttention => query.Where(employee =>
                (requiresJobTitle && (employee.JobTitle == null || employee.JobTitle == string.Empty))
                || employee.OrgUnitId == null
                || (employee.ManagerId.HasValue && employee.Manager == null)
                || (employee.ManagerId.HasValue && employee.Manager != null && employee.Manager.Status != Domain.Enums.EmployeeStatus.Active)),
            EmployeeReadinessFilter.MissingRequiredField => requiresJobTitle
                ? query.Where(employee => employee.JobTitle == null || employee.JobTitle == string.Empty)
                : query.Where(_ => false),
            EmployeeReadinessFilter.MissingOrgUnit => query.Where(employee => employee.OrgUnitId == null),
            EmployeeReadinessFilter.ReportingIssue => query.Where(employee =>
                (employee.ManagerId.HasValue && employee.Manager == null)
                || (employee.ManagerId.HasValue && employee.Manager != null && employee.Manager.Status != Domain.Enums.EmployeeStatus.Active)),
            EmployeeReadinessFilter.NoManagerAssigned => query.Where(employee =>
                !employee.ManagerId.HasValue
                && !dbContext.Employees.Any(report => report.ManagerId == employee.Id && report.Status == Domain.Enums.EmployeeStatus.Active)),
            EmployeeReadinessFilter.ManagerInactive => query.Where(employee =>
                employee.ManagerId.HasValue
                && employee.Manager != null
                && employee.Manager.Status != Domain.Enums.EmployeeStatus.Active),
            EmployeeReadinessFilter.ManagerMissing => query.Where(employee => employee.ManagerId.HasValue && employee.Manager == null),
            EmployeeReadinessFilter.DeactivationBlocked => query.Where(employee =>
                employee.Status == Domain.Enums.EmployeeStatus.Active
                && dbContext.Employees.Any(report => report.ManagerId == employee.Id && report.Status == Domain.Enums.EmployeeStatus.Active)),
            _ => query
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
