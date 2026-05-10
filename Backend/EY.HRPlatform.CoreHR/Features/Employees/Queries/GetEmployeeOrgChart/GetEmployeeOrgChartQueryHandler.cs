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
        var baseQuery = CreateVisibleEmployeesQuery(request.IncludeInactive);

        // Resolve effective root: explicit RootEmployeeId → focus-derived root → full org
        Guid? effectiveRootId = request.RootEmployeeId;
        if (!effectiveRootId.HasValue && request.FocusEmployeeId.HasValue)
        {
            effectiveRootId = await ResolveChainRootAsync(baseQuery, request.FocusEmployeeId.Value, cancellationToken);
            if (!effectiveRootId.HasValue)
            {
                return Result.Failure<EmployeeOrgChartDto>(Error.NotFound("Employee", request.FocusEmployeeId.Value));
            }
        }

        var (employees, requestedRoot) = await LoadEmployeesForRequestAsync(
            baseQuery,
            effectiveRootId,
            maxDepth,
            cancellationToken);

        if (effectiveRootId.HasValue && requestedRoot is null)
        {
            return Result.Failure<EmployeeOrgChartDto>(Error.NotFound("Employee", effectiveRootId.Value));
        }

        // Apply org unit filter: keep employees in the requested org unit plus their
        // visible ancestors so the chart hierarchy remains coherent and not misleading.
        if (request.OrgUnitId.HasValue)
        {
            employees = FilterByOrgUnitWithAncestors(employees, request.OrgUnitId.Value);
        }

        var employeesById = employees.ToDictionary(employee => employee.Id);

        var childrenMap = employees
            .Where(employee => employee.ManagerId.HasValue && employeesById.ContainsKey(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .ToDictionary(group => group.Key, group => group.OrderBy(employee => employee.LastName).ThenBy(employee => employee.FirstName).ToList());

        var directReportCounts = childrenMap.ToDictionary(group => group.Key, group => group.Value.Count);
        var roots = effectiveRootId.HasValue
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

        var issueCounts = ComputeIssueCounts(employees);

        return Result.Success(
            new EmployeeOrgChartDto(
                tree,
                request.RootEmployeeId,
                request.FocusEmployeeId,
                request.OrgUnitId,
                maxDepth,
                request.IncludeInactive,
                visibleNodeCount,
                isTruncated,
                issueCounts));
    }

    private IQueryable<Employee> CreateVisibleEmployeesQuery(bool includeInactive)
    {
        var query = dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(employee => employee.Status == Domain.Enums.EmployeeStatus.Active);
        }

        return query;
    }

    /// <summary>
    /// Walk the manager chain from the given employee upward (with cycle guard) to find
    /// the topmost ancestor in the visible employee set. Returns the root's ID, or null
    /// if the focus employee does not exist.
    /// </summary>
    private async Task<Guid?> ResolveChainRootAsync(
        IQueryable<Employee> baseQuery,
        Guid focusEmployeeId,
        CancellationToken cancellationToken)
    {
        var focusEmployee = await baseQuery
            .AsNoTracking()
            .Select(e => new { e.Id, e.ManagerId })
            .FirstOrDefaultAsync(e => e.Id == focusEmployeeId, cancellationToken);

        if (focusEmployee is null)
        {
            return null;
        }

        var visited = new HashSet<Guid> { focusEmployee.Id };
        var currentId = focusEmployee.ManagerId;
        var rootId = focusEmployee.Id;

        while (currentId.HasValue)
        {
            if (!visited.Add(currentId.Value))
            {
                // Cycle detected — stop here; rootId is the last clean ancestor
                break;
            }

            var manager = await baseQuery
                .AsNoTracking()
                .Select(e => new { e.Id, e.ManagerId })
                .FirstOrDefaultAsync(e => e.Id == currentId.Value, cancellationToken);

            if (manager is null)
            {
                // Manager is outside the visible set — rootId stays as the last valid ancestor
                break;
            }

            rootId = manager.Id;
            currentId = manager.ManagerId;
        }

        return rootId;
    }

    /// <summary>
    /// Filter the loaded employee list to those belonging to the requested org unit,
    /// plus all their manager-chain ancestors needed to keep the hierarchy coherent.
    /// </summary>
    private static List<Employee> FilterByOrgUnitWithAncestors(
        List<Employee> employees,
        Guid orgUnitId)
    {
        var allById = employees.ToDictionary(e => e.Id);
        var result = new Dictionary<Guid, Employee>();

        foreach (var employee in employees.Where(e => e.OrgUnitId == orgUnitId))
        {
            // Include the employee
            result.TryAdd(employee.Id, employee);

            // Walk up and include all managers so the chart stays connected
            var managerId = employee.ManagerId;
            var seen = new HashSet<Guid> { employee.Id };
            while (managerId.HasValue && seen.Add(managerId.Value) && allById.TryGetValue(managerId.Value, out var manager))
            {
                result.TryAdd(manager.Id, manager);
                managerId = manager.ManagerId;
            }
        }

        return [.. result.Values];
    }

    private static OrgChartIssueCountsDto ComputeIssueCounts(List<Employee> employees)
    {
        int noManagerAssigned = 0, managerInactive = 0, managerMissing = 0, missingOrgUnit = 0;

        foreach (var employee in employees)
        {
            if (employee.OrgUnitId is null)
            {
                missingOrgUnit++;
            }

            if (employee.ManagerId is null)
            {
                noManagerAssigned++;
            }
            else if (employee.Manager is null)
            {
                managerMissing++;
            }
            else if (employee.Manager.Status != Domain.Enums.EmployeeStatus.Active)
            {
                managerInactive++;
            }
        }

        return new OrgChartIssueCountsDto(noManagerAssigned, managerInactive, managerMissing, missingOrgUnit);
    }

    private static IOrderedQueryable<Employee> OrderEmployees(IQueryable<Employee> query)
        => query
            .OrderBy(employee => employee.LastName)
            .ThenBy(employee => employee.FirstName);

    private async Task<(List<Employee> Employees, Employee? RequestedRoot)> LoadEmployeesForRequestAsync(
        IQueryable<Employee> query,
        Guid? rootEmployeeId,
        int maxDepth,
        CancellationToken cancellationToken)
    {
        if (!rootEmployeeId.HasValue)
        {
            return (await OrderEmployees(query).ToListAsync(cancellationToken), null);
        }

        var requestedRoot = await query.SingleOrDefaultAsync(
            employee => employee.Id == rootEmployeeId.Value,
            cancellationToken);

        if (requestedRoot is null)
        {
            return ([], null);
        }

        var employeesById = new Dictionary<Guid, Employee>
        {
            [requestedRoot.Id] = requestedRoot
        };
        var frontierIds = new HashSet<Guid> { requestedRoot.Id };

        for (var level = 1; level <= maxDepth + 1 && frontierIds.Count > 0; level++)
        {
            var currentFrontierIds = frontierIds.ToArray();
            frontierIds.Clear();

            var directReports = await OrderEmployees(query.Where(
                    employee => employee.ManagerId.HasValue && currentFrontierIds.Contains(employee.ManagerId.Value)))
                .ToListAsync(cancellationToken);

            foreach (var directReport in directReports)
            {
                if (!employeesById.TryAdd(directReport.Id, directReport))
                {
                    continue;
                }

                if (level <= maxDepth)
                {
                    frontierIds.Add(directReport.Id);
                }
            }
        }

        return ([.. employeesById.Values], requestedRoot);
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