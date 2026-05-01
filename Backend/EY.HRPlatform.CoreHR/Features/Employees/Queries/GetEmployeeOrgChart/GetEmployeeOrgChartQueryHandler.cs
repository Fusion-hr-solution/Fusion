using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;

public sealed class GetEmployeeOrgChartQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetEmployeeOrgChartQuery, Result<EmployeeOrgChartDto>>
{
    public async Task<Result<EmployeeOrgChartDto>> Handle(
        GetEmployeeOrgChartQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        var maxDepth = Math.Clamp(request.MaxDepth, 1, 10);
        var query = dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .AsQueryable();

        if (!request.IncludeInactive)
        {
            query = query.Where(employee => employee.Status == Domain.Enums.EmployeeStatus.Active);
        }

        var employees = await query
            .OrderBy(employee => employee.LastName)
            .ThenBy(employee => employee.FirstName)
            .ToListAsync(cancellationToken);

        var employeesById = employees.ToDictionary(employee => employee.Id);

        Employee? requestedRoot = null;

        if (request.RootEmployeeId.HasValue)
        {
            if (!employeesById.TryGetValue(request.RootEmployeeId.Value, out requestedRoot))
            {
                return Result.Failure<EmployeeOrgChartDto>(Error.NotFound("Employee", request.RootEmployeeId.Value));
            }
        }

        var childrenMap = employees
            .Where(employee => employee.ManagerId.HasValue && employeesById.ContainsKey(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .ToDictionary(group => group.Key, group => group.OrderBy(employee => employee.LastName).ThenBy(employee => employee.FirstName).ToList());

        var directReportCounts = childrenMap.ToDictionary(group => group.Key, group => group.Value.Count);
        var roots = request.RootEmployeeId.HasValue
            ? new List<(Employee Employee, bool IsOrphaned)> { (requestedRoot!, false) }
            : employees
                .Where(employee => !employee.ManagerId.HasValue || !employeesById.ContainsKey(employee.ManagerId.Value))
                .Select(employee => (Employee: employee, IsOrphaned: employee.ManagerId.HasValue))
                .OrderBy(root => root.Employee.LastName)
                .ThenBy(root => root.Employee.FirstName)
                .ToList();

        var visibleNodeCount = 0;
        var isTruncated = false;
        var tree = roots
            .Select(root => BuildTreeNode(
                root.Employee,
                root.IsOrphaned,
                0,
                maxDepth,
                childrenMap,
                directReportCounts,
                settings,
                ref visibleNodeCount,
                ref isTruncated,
                []))
            .ToList();

        return Result.Success(
            new EmployeeOrgChartDto(
                tree,
                request.RootEmployeeId,
                maxDepth,
                request.IncludeInactive,
                visibleNodeCount,
                isTruncated));
    }

    private EmployeeOrgChartNodeDto BuildTreeNode(
        Employee employee,
        bool isOrphaned,
        int currentLevel,
        int maxDepth,
        IReadOnlyDictionary<Guid, List<Employee>> childrenMap,
        IReadOnlyDictionary<Guid, int> directReportCounts,
        Features.TenantSettings.Dtos.TenantSettingsDto settings,
        ref int visibleNodeCount,
        ref bool isTruncated,
        HashSet<Guid> ancestors)
    {
        visibleNodeCount++;
        var nextAncestors = new HashSet<Guid>(ancestors) { employee.Id };
        var hasVisibleChildren = childrenMap.TryGetValue(employee.Id, out var directReports) && directReports.Count > 0;
        var visibleChildren = new List<EmployeeOrgChartNodeDto>();

        if (hasVisibleChildren)
        {
            if (currentLevel < maxDepth)
            {
                foreach (var directReport in directReports!)
                {
                    if (nextAncestors.Contains(directReport.Id))
                    {
                        isTruncated = true;
                        continue;
                    }

                    visibleChildren.Add(BuildTreeNode(
                        directReport,
                        false,
                        currentLevel + 1,
                        maxDepth,
                        childrenMap,
                        directReportCounts,
                        settings,
                        ref visibleNodeCount,
                        ref isTruncated,
                        nextAncestors));
                }
            }
            else
            {
                isTruncated = true;
            }
        }

        var listItem = employeeReadModelPolicy
            .MapListItem(employee, settings, EmployeeReadAudience.HrAdmin)
            with
            {
                DirectReportCount = directReportCounts.GetValueOrDefault(employee.Id)
            };

        return new EmployeeOrgChartNodeDto(
            listItem.Id,
            $"{listItem.FirstName} {listItem.LastName}",
            listItem.FirstName,
            listItem.LastName,
            listItem.Email,
            listItem.JobTitle,
            listItem.Status,
            listItem.OrgUnitId,
            listItem.OrgUnitName,
            listItem.ManagerId,
            listItem.ManagerName,
            listItem.HierarchyStatus,
            listItem.DirectReportCount,
            hasVisibleChildren,
            isOrphaned,
            currentLevel,
            visibleChildren,
            listItem.Version);
    }
}